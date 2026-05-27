/**
 * POST /api/demo/capture — store a demo lead inquiry.
 * Public route (no auth required). Writes to demo_inquiries table.
 * Body: { name, email, phone?, brokerage?, role?, agentCount? }
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';

export async function POST(req: NextRequest) {
  let body: {
    name?:       string;
    email?:      string;
    phone?:      string;
    brokerage?:  string;
    role?:       string;
    agentCount?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const name  = body.name?.trim()  ?? '';
  const email = body.email?.trim() ?? '';

  if (!name || !email) {
    return NextResponse.json({ error: 'Name and email are required' }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from('demo_inquiries').insert({
    name,
    email,
    phone:       body.phone?.trim()      || null,
    brokerage:   body.brokerage?.trim()  || null,
    role:        body.role?.trim()       || null,
    agent_count: body.agentCount?.trim() || null,
  });

  if (error) {
    console.error('[POST /api/demo/capture]', error.message);
    return NextResponse.json({ error: 'Failed to save inquiry' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
