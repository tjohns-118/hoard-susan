/**
 * /api/agents — server-side CRUD for the agent system.
 *
 * Uses supabaseAdmin (service role) so it can write past RLS.
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local.
 *
 * POST   — create agent  (inserts app_users → brokerage_members → agent_profiles)
 * PATCH  — update role or notes
 * DELETE — soft-delete   (sets brokerage_members.is_active = false)
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';

const BROKERAGE_SLUG =
  process.env.ACTIVE_BROKERAGE_SLUG ?? 'ranch-properties';

async function getBrokerageId(): Promise<string | null> {
  const envId = process.env.ACTIVE_BROKERAGE_ID ?? process.env.NEXT_PUBLIC_ACTIVE_BROKERAGE_ID;
  if (envId) return envId;

  const { data } = await supabaseAdmin
    .from('brokerages')
    .select('id')
    .eq('slug', BROKERAGE_SLUG)
    .maybeSingle();

  return (data?.id as string) ?? null;
}

// ── POST /api/agents — create new agent ──────────────────────────────────────

export async function POST(req: NextRequest) {
  const { name, email, phone, role } = await req.json() as {
    name: string;
    email: string;
    phone?: string;
    role?: string;
  };

  if (!name || !email) {
    return NextResponse.json({ error: 'name and email are required' }, { status: 400 });
  }

  const brokerageId = await getBrokerageId();
  if (!brokerageId) {
    return NextResponse.json({ error: 'Active brokerage not found — seed brokerages first' }, { status: 404 });
  }

  // 1. Insert into app_users
  const { data: user, error: userErr } = await supabaseAdmin
    .from('app_users')
    .insert({ full_name: name, email, phone: phone || null })
    .select('id')
    .single();

  if (userErr || !user) {
    return NextResponse.json({ error: userErr?.message ?? 'Failed to create user' }, { status: 500 });
  }

  // 2. Insert into brokerage_members
  const { data: member, error: memberErr } = await supabaseAdmin
    .from('brokerage_members')
    .insert({
      brokerage_id: brokerageId,
      user_id: user.id,
      role: role ?? 'agent',
      is_active: true,
    })
    .select('id')
    .single();

  if (memberErr || !member) {
    return NextResponse.json({ error: memberErr?.message ?? 'Failed to create member' }, { status: 500 });
  }

  // 3. Insert into agent_profiles
  const { error: profileErr } = await supabaseAdmin
    .from('agent_profiles')
    .insert({ brokerage_member_id: member.id, notes: '' });

  if (profileErr) {
    return NextResponse.json({ error: profileErr.message }, { status: 500 });
  }

  return NextResponse.json({ memberId: member.id, userId: user.id }, { status: 201 });
}

// ── PATCH /api/agents — update role or notes ─────────────────────────────────

export async function PATCH(req: NextRequest) {
  const { memberId, role, notes } = await req.json() as {
    memberId: string;
    role?: string;
    notes?: string;
  };

  if (!memberId) {
    return NextResponse.json({ error: 'memberId is required' }, { status: 400 });
  }

  if (role !== undefined) {
    const { error } = await supabaseAdmin
      .from('brokerage_members')
      .update({ role })
      .eq('id', memberId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (notes !== undefined) {
    const { error } = await supabaseAdmin
      .from('agent_profiles')
      .update({ notes, updated_at: new Date().toISOString() })
      .eq('brokerage_member_id', memberId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// ── DELETE /api/agents?memberId=<id> — soft-delete ───────────────────────────

export async function DELETE(req: NextRequest) {
  const memberId = req.nextUrl.searchParams.get('memberId');

  if (!memberId) {
    return NextResponse.json({ error: 'memberId query param is required' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('brokerage_members')
    .update({ is_active: false })
    .eq('id', memberId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
