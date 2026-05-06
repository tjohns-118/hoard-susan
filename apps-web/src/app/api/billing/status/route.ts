/**
 * GET /api/billing/status — returns the brokerage's Stripe billing state.
 * Broker-only. Returns boolean/string fields only — no Stripe secret data.
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

  if (billingResult.error) {
    console.error('[GET /api/billing/status]', billingResult.error.message);
    return NextResponse.json({ error: 'Failed to load billing status' }, { status: 500 });
  }

  const data = billingResult.data;

  return NextResponse.json({
    hasCustomer:      Boolean(data?.stripe_customer_id),
    hasSubscription:  Boolean(data?.stripe_subscription_id),
    status:           data?.subscription_status              ?? null,
    currentPeriodEnd: data?.subscription_current_period_end  ?? null,
    billingEmail:     data?.billing_email                    ?? null,
    billingPlan:      data?.billing_plan                     ?? null,
    activeAgentCount: agentCountResult.count ?? 0,
  });
}
