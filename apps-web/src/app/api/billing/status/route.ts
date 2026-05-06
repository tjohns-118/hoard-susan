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

  const { data, error } = await supabaseAdmin
    .from('brokerages')
    .select('stripe_customer_id, stripe_subscription_id, subscription_status, subscription_current_period_end, billing_email')
    .eq('id', brokerageId)
    .maybeSingle();

  if (error) {
    console.error('[GET /api/billing/status]', error.message);
    return NextResponse.json({ error: 'Failed to load billing status' }, { status: 500 });
  }

  return NextResponse.json({
    hasCustomer:      Boolean(data?.stripe_customer_id),
    hasSubscription:  Boolean(data?.stripe_subscription_id),
    status:           data?.subscription_status           ?? null,
    currentPeriodEnd: data?.subscription_current_period_end ?? null,
    billingEmail:     data?.billing_email                 ?? null,
  });
}
