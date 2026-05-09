/**
 * POST /api/sms/test — send a test SMS to verify Twilio credentials.
 *
 * Broker/admin only. Body: { to: string }
 * Returns send result without exposing any secrets.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMembership } from '@/lib/getMembership';
import { sendSms } from '@/lib/sms/provider';

export async function POST(req: NextRequest) {
  const membership = await getMembership();
  if (!membership)
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  if (membership.role !== 'broker' && membership.role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let to: string;
  try {
    const body = await req.json();
    to = (body?.to ?? '').trim();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!to) return NextResponse.json({ error: 'Missing "to" phone number' }, { status: 400 });

  const result = await sendSms({
    to,
    body: 'Hoard SMS test — your Twilio configuration is working correctly.',
  });

  return NextResponse.json({
    success:        result.success,
    credentialMode: result.credentialMode ?? 'none',
    messageId:      result.messageId ?? null,
    error:          result.error ?? null,
  }, { status: result.success ? 200 : 502 });
}
