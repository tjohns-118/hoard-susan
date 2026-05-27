/**
 * POST /api/demo/login
 *
 * Signs the visitor into the shared demo account and redirects to the
 * dashboard.  Uses a Route Handler (not a Server Action) so that
 * @supabase/ssr can write auth cookies onto the NextResponse — the only
 * context where cookie writes are permitted outside of Server Actions.
 *
 * On success  → 303 redirect to /
 * On failure  → 303 redirect to /demo-playground?error=demo_login_failed
 */

import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const email    = process.env.DEMO_USER_EMAIL;
  const password = process.env.DEMO_USER_PASSWORD;

  const errorUrl   = new URL('/demo-playground?error=demo_login_failed', req.url);
  const successUrl = new URL('/', req.url);

  if (!email || !password) {
    console.error('[POST /api/demo/login] DEMO_USER_EMAIL or DEMO_USER_PASSWORD not set');
    return NextResponse.redirect(errorUrl, { status: 303 });
  }

  // Build the success redirect first so we can write auth cookies onto it.
  const response = NextResponse.redirect(successUrl, { status: 303 });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // Read incoming cookies from the request.
        getAll() {
          return req.cookies.getAll();
        },
        // Write auth cookies onto the response — this is what was broken
        // when a Server Action tried to call cookieStore.set() outside of
        // the allowed RSC/Server Action context in production.
        setAll(toSet) {
          toSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    console.error('[POST /api/demo/login] signInWithPassword error:', error.message);
    return NextResponse.redirect(errorUrl, { status: 303 });
  }

  return response;
}
