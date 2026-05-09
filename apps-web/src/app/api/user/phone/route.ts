/**
 * PATCH /api/user/phone
 *
 * Updates the authenticated user's phone number and/or SMS reminder preference.
 * Body: { phone?: string; sms_reminders_enabled?: boolean }
 *
 * Phone is normalized to E.164 (+17023557823).
 * Accepts 10-digit US numbers, 11-digit with leading 1, or full E.164.
 * Rejects invalid formats with a user-friendly error.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { getSessionUser } from '@/lib/getSessionUser';
import { getMembership } from '@/lib/getMembership';

// US-aware E.164 normalizer — handles 10-digit, 11-digit, and +country formats.
export function normalizePhoneInput(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits[0] === '1') return `+${digits}`;
  if (raw.trim().startsWith('+')) {
    const e164 = `+${digits}`;
    return /^\+[1-9]\d{6,14}$/.test(e164) ? e164 : null;
  }
  return null;
}

export async function PATCH(req: NextRequest) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  // getMembership also triggers lazy auth_user_id linking so the update below always hits a row.
  const membership = await getMembership(sessionUser.id, sessionUser.email);
  if (!membership) return NextResponse.json({ error: 'No membership found' }, { status: 403 });

  let body: { phone?: string; sms_reminders_enabled?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};

  if (body.phone !== undefined) {
    const raw = body.phone?.trim() ?? '';
    if (!raw) {
      return NextResponse.json({ error: 'Phone number cannot be empty.' }, { status: 400 });
    }
    const normalized = normalizePhoneInput(raw);
    if (!normalized) {
      return NextResponse.json(
        { error: 'Invalid phone number. Enter a 10-digit US number or full international format (e.g. +17023557823).' },
        { status: 400 },
      );
    }
    updates.phone = normalized;
  }

  if (body.sms_reminders_enabled !== undefined) {
    updates.sms_reminders_enabled = Boolean(body.sms_reminders_enabled);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields provided.' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('app_users')
    .update(updates)
    .eq('auth_user_id', sessionUser.id);

  if (error) {
    console.error('[PATCH /api/user/phone] update failed:', error.message);
    return NextResponse.json({ error: 'Failed to save changes.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, ...updates });
}
