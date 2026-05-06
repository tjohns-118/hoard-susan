/**
 * GET /api/billing/status — returns the brokerage's Stripe billing state.
 *
 * Broker-only. Never calls Stripe — reads only from the local DB.
 * Fails open: if the billing columns don't exist yet (migration pending),
 * returns safe nulls instead of a 500 so the UI stays usable.
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { getSessionUser } from '@/lib/getSessionUser';
import { getMembership } from '@/lib/getMembership';
import { getBrokerageId } from '@/lib/getBrokerageId';

export async function GET() {
  const sessionUser = await getSessionUser();
  if (!sessionUser)
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const membership = await getMembership(sessionUser.id, sessionUser.email);
  if (!membership)
    return NextResponse.json({ error: 'No brokerage membership found' }, { status: 403 });
  if (membership.role !== 'broker')
    return NextResponse.json({ error: 'Broker access required' }, { status: 403 });

  const brokerageId = await getBrokerageId();
  if (!brokerageId)
    return NextResponse.json({ error: 'Brokerage not configured' }, { status: 503 });

  // Stripe configuration check — env only, no network call.
  const stripeConfigured = Boolean(
    process.env.STRIPE_SECRET_KEY?.trim() &&
    (
      process.env.STRIPE_PRICE_BROKERAGE_MONTHLY?.trim()  ||
      process.env.STRIPE_PRICE_BROKERAGE_ANNUAL?.trim()   ||
      process.env.STRIPE_PRICE_BROKERAGE_BIWEEKLY?.trim()
    )
  );

  // Run queries in parallel. Agent count uses a plain select that never fails on missing cols.
  const [billingResult, agentCountResult] = await Promise.all([
    supabaseAdmin
      .from('brokerages')
      .select('stripe_customer_id, stripe_subscription_id, subscription_status, subscription_current_period_end, billing_email, billing_plan')
      .eq('id', brokerageId)
      .maybeSingle(),
    supabaseAdmin
      .from('brokerage_members')
      .select('id', { count: 'exact', head: true })
      .eq('brokerage_id', brokerageId)
      .eq('is_active', true)
      .neq('role', 'broker'),
  ]);

  // If billing columns are missing (migration not yet applied), fail open with
  // safe nulls so the UI shows "no subscription" rather than an error banner.
  if (billingResult.error) {
    console.warn(
      '[GET /api/billing/status] billing columns query failed — run the billing migration:',
      billingResult.error.message,
    );
  }

  const d                  = billingResult.error ? null : billingResult.data;
  const stripeCustomerId   = (d?.stripe_customer_id              as string | null) ?? null;
  const stripeSubscriptionId = (d?.stripe_subscription_id        as string | null) ?? null;
  const status             = (d?.subscription_status             as string | null) ?? null;
  const currentPeriodEnd   = (d?.subscription_current_period_end as string | null) ?? null;
  const billingEmail       = (d?.billing_email                   as string | null) ?? null;
  const plan               = (d?.billing_plan                    as string | null) ?? null;
  const billableAgentCount = agentCountResult.error ? 0 : (agentCountResult.count ?? 0);
  const portalAvailable    = Boolean(stripeCustomerId);

  return NextResponse.json({
    status,
    plan,
    stripeCustomerId,
    stripeSubscriptionId,
    currentPeriodEnd,
    billingEmail,
    billableAgentCount,
    stripeConfigured,
    portalAvailable,
  });
}
