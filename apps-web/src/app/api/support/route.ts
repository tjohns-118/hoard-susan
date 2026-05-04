/**
 * Deprecated — use /api/support/tickets instead.
 */
import { NextRequest, NextResponse } from 'next/server';

function redirect(req: NextRequest) {
  const url = req.nextUrl.clone();
  url.pathname = '/api/support/tickets';
  return NextResponse.redirect(url, 308);
}

export const GET    = redirect;
export const POST   = redirect;
export const PATCH  = redirect;
