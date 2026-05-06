/**
 * GET /api/billing/config — Stripe configuration diagnostic.
 *
 * Returns boolean flags only — no secret values exposed.
 * Broker-only. Use this to verify Vercel env vars are set correctly.
 */

import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/getSessionUser';
import { getMembership } from '@/lib/getMembership';

export async function GET() {
  const sessionUser = await getSessionUser();
  if (!sessionUser)
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const membership = await getMembership(sessionUser.id, sessionUser.email);
  if (!membership)
    return NextResponse.json({ error: 'No brokerage membership found' }, { status: 403 });
  if (membership.role !== 'broker')
    return NextResponse.json({ error: 'Broker access required' }, { status: 403 });

  const hasStripeSecretKey     = Boolean(process.env.STRIPE_SECRET_KEY?.trim());
  const hasStripeWebhookSecret = Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim());
  const hasMonthlyPrice        = Boolean(process.env.STRIPE_PRICE_BROKERAGE_MONTHLY?.trim());
  const hasAnnualPrice         = Boolean(process.env.STRIPE_PRICE_BROKERAGE_ANNUAL?.trim());
  const hasBiweeklyPrice       = Boolean(process.env.STRIPE_PRICE_BROKERAGE_BIWEEKLY?.trim());
  const hasNextPublicAppUrl    = Boolean(process.env.NEXT_PUBLIC_APP_URL?.trim());

  const stripeConfigured = hasStripeSecretKey && (hasMonthlyPrice || hasAnnualPrice || hasBiweeklyPrice);

  let configError: string | null = null;
  if (!hasStripeSecretKey)
    configError = 'STRIPE_SECRET_KEY is not set';
  else if (!hasStripeWebhookSecret)
    configError = 'STRIPE_WEBHOOK_SECRET is not set';
  else if (!hasMonthlyPrice && !hasAnnualPrice && !hasBiweeklyPrice)
    configError = 'No price IDs configured — set STRIPE_PRICE_BROKERAGE_MONTHLY, _ANNUAL, or _BIWEEKLY';
  else if (!hasNextPublicAppUrl)
    configError = 'NEXT_PUBLIC_APP_URL is not set';

  return NextResponse.json({
    hasStripeSecretKey,
    hasStripeWebhookSecret,
    hasMonthlyPrice,
    hasAnnualPrice,
    hasBiweeklyPrice,
    hasNextPublicAppUrl,
    stripeConfigured,
    configError,
  });
}
