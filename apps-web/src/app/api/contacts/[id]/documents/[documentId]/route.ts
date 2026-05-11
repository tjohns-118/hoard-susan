/**
 * /api/contacts/[id]/documents/[documentId]
 *
 * DELETE — remove a document. Allowed for: the uploader, broker, admin.
 *          Removes both the storage file and the metadata row.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { getBrokerageId } from '@/lib/getBrokerageId';
import { getSessionUser } from '@/lib/getSessionUser';
import { getMembership } from '@/lib/getMembership';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; documentId: string }> },
) {
  const [brokerageId, user] = await Promise.all([getBrokerageId(), getSessionUser()]);
  if (!brokerageId || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const membership = await getMembership(user.id, user.email);
  if (!membership) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: contactId, documentId } = await params;

  const { data: doc } = await supabaseAdmin
    .from('contact_documents')
    .select('id, file_path, brokerage_id, uploaded_by_member_id')
    .eq('id', documentId)
    .eq('contact_id', contactId)
    .eq('brokerage_id', brokerageId)
    .maybeSingle();

  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

  const isBrokerOrAdmin = membership.role === 'broker' || membership.role === 'admin';
  const isUploader      = doc.uploaded_by_member_id === membership.memberId;

  if (!isBrokerOrAdmin && !isUploader) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  await supabaseAdmin.storage.from('contact-documents').remove([doc.file_path]);

  const { error } = await supabaseAdmin
    .from('contact_documents')
    .delete()
    .eq('id', documentId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
