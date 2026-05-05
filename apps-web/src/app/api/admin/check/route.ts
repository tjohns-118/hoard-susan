/**
 * GET /api/admin/check
 *
 * Returns { isAdmin: boolean } for the current session.
 * Admin if: session user email is in ADMIN_EMAIL env var (comma-separated)
 *        OR: brokerage_members role === 'admin'
 */

import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/getSessionUser';
import { getMembership } from '@/lib/getMembership';

export function isAdminEmail(email: string): boolean {
  const raw = process.env.ADMIN_EMAIL ?? '';
  if (!raw) return false;
  const allowed = raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  return allowed.includes(email.toLowerCase());
}

export async function GET() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return NextResponse.json({ isAdmin: false });

  if (isAdminEmail(sessionUser.email)) return NextResponse.json({ isAdmin: true });

  try {
    const membership = await getMembership(sessionUser.id, sessionUser.email);
    if (membership?.role === 'admin') return NextResponse.json({ isAdmin: true });
  } catch {}

  return NextResponse.json({ isAdmin: false });
}
