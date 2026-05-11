/**
 * /api/contacts/[id]/documents — document history for a single contact.
 *
 * GET  — list all documents for the contact (includes 1-hour signed URLs).
 * POST — upload a file + metadata (multipart/form-data).
 *
 * Auth: session required. Brokerage scoped. Agents may only access contacts
 * assigned to them. Brokers/admins can access any contact in the brokerage.
 *
 * Allowed MIME types: PDF, DOC/DOCX, PNG, JPG/JPEG, TXT.
 * Max file size: 10 MB.
 * Storage bucket: contact-documents (must be created in Supabase Dashboard,
 * set to private — no public access).
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { getBrokerageId } from '@/lib/getBrokerageId';
import { getSessionUser } from '@/lib/getSessionUser';
import { getMembership } from '@/lib/getMembership';

const ALLOWED_MIME = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg',
  'text/plain',
]);

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

type Context = { brokerageId: string; membership: Awaited<ReturnType<typeof getMembership>> & object };

async function resolveContext(): Promise<Context | null> {
  const [brokerageId, user] = await Promise.all([getBrokerageId(), getSessionUser()]);
  if (!brokerageId || !user) return null;
  const membership = await getMembership(user.id, user.email);
  if (!membership) return null;
  return { brokerageId, membership };
}

async function requireContactAccess(
  brokerageId: string,
  contactId: string,
  memberId: string,
  role: string,
): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('contacts')
    .select('id, assigned_member_id')
    .eq('id', contactId)
    .eq('brokerage_id', brokerageId)
    .maybeSingle();
  if (!data) return false;
  if (role === 'agent' && data.assigned_member_id !== memberId) return false;
  return true;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await resolveContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { brokerageId, membership } = ctx;

  const { id: contactId } = await params;

  const ok = await requireContactAccess(brokerageId, contactId, membership.memberId, membership.role);
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: docs, error } = await supabaseAdmin
    .from('contact_documents')
    .select('*')
    .eq('brokerage_id', brokerageId)
    .eq('contact_id', contactId)
    .order('uploaded_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const withUrls = await Promise.all(
    (docs ?? []).map(async (doc) => {
      const { data: signed } = await supabaseAdmin.storage
        .from('contact-documents')
        .createSignedUrl(doc.file_path, 3600);
      return { ...doc, signedUrl: signed?.signedUrl ?? null };
    }),
  );

  return NextResponse.json(withUrls);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await resolveContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { brokerageId, membership } = ctx;

  const { id: contactId } = await params;

  const ok = await requireContactAccess(brokerageId, contactId, membership.memberId, membership.role);
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const file = formData.get('file') as File | null;
  if (!file || file.size === 0) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json(
      { error: 'File type not allowed. Accepted: PDF, DOC, DOCX, PNG, JPG, TXT.' },
      { status: 400 },
    );
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File exceeds the 10 MB limit.' }, { status: 400 });
  }

  const documentType = ((formData.get('documentType') as string) ?? '').trim() || null;
  const notes        = ((formData.get('notes')        as string) ?? '').trim() || null;
  const signedAtRaw  = ((formData.get('signedAt')     as string) ?? '').trim();
  const signedAt     = signedAtRaw || null;

  const ext      = file.name.split('.').pop() ?? 'bin';
  const filePath = `${brokerageId}/${contactId}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from('contact-documents')
    .upload(filePath, file, { contentType: file.type, upsert: false });

  if (uploadError) {
    return NextResponse.json({ error: `Storage error: ${uploadError.message}` }, { status: 500 });
  }

  const { data: doc, error: insertError } = await supabaseAdmin
    .from('contact_documents')
    .insert({
      brokerage_id:          brokerageId,
      contact_id:            contactId,
      uploaded_by_member_id: membership.memberId,
      file_name:             file.name,
      file_path:             filePath,
      file_type:             file.type,
      file_size:             file.size,
      document_type:         documentType,
      notes,
      signed_at:             signedAt,
    })
    .select()
    .single();

  if (insertError) {
    await supabaseAdmin.storage.from('contact-documents').remove([filePath]);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json(doc, { status: 201 });
}
