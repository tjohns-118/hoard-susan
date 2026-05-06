/**
 * POST /api/billing/checkout — create a Stripe Checkout session.
 *
 * Body: { plan?: 'brokerage_monthly' | 'brokerage_annual' | 'brokerage_biweekly' }
 *
 * Broker-only. Creates or reuses a Stripe customer, counts active non-broker
 * agents for quantity, then creates a subscription checkout session.
 * Returns { url } — client redirects there.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { getSessionUser } from '@/lib/getSessionUser';
import { getMembership } from '@/lib/getMembership';
import { getBrokerageId } from '@/lib/getBrokerageId';
import { stripePost } from '@/lib/stripe';

interface StripeCustomer        { id: string }
interface StripeCheckoutSession { id: string; url: string }

// Server-side plan → env var mapping. Client never sends a raw price ID.
const PLAN_ENV: Record<string, string> = {
  brokerage_monthly:  'STRIPE_PRICE_BROKERAGE_MONTHLY',
  brokerage_annual:   'STRIPE_PRICE_BROKERAGE_ANNUAL',
  brokerage_biweekly: 'STRIPE_PRICE_BROKERAGE_BIWEEKLY',
};

function resolvePriceId(plan: string): string | null {
  const envKey = PLAN_ENV[plan];
  if (!envKey) return null;
  return process.env[envKey]?.trim() || null;
}

export async function POST(req: NextRequest) {
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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!appUrl)
    return NextResponse.json({ error: 'NEXT_PUBLIC_APP_URL is not configured' }, { status: 503 });

  // Parse plan from body; default to brokerage_monthly.
  let plan = 'brokerage_monthly';
  try {
    const body = await req.json() as { plan?: string };
    if (body.plan && PLAN_ENV[body.plan]) plan = body.plan;
  } catch { /* no body — use default */ }

  const priceId = resolvePriceId(plan);
  if (!priceId)
    return NextResponse.json({ error: `Price ID for plan "${plan}" is not configured (set ${PLAN_ENV[plan]})` }, { status: 503 });

  // Count active non-broker agents → billing quantity (min 1).
  const { count: agentCount } = await supabaseAdmin
    .from('brokerage_members')
    .select('id', { count: 'exact', head: true })
    .eq('brokerage_id', brokerageId)
    .eq('is_active', true)
    .neq('role', 'broker');
  const quantity = String(Math.max(1, agentCount ?? 1));

  // Load brokerage to check for existing Stripe customer.
  const { data: brokerage, error: dbErr } = await supabaseAdmin
    .from('brokerages')
    .select('id, name, billing_email, stripe_customer_id')
    .eq('id', brokerageId)
    .maybeSingle();

  if (dbErr || !brokerage)
    return NextResponse.json({ error: 'Failed to load brokerage' }, { status: 500 });

  let customerId = brokerage.stripe_customer_id as string | null;

  // Create Stripe customer if none exists.
  if (!customerId) {
    try {
      const customer = await stripePost<StripeCustomer>('customers', {
        email:                    sessionUser.email,
        name:                     brokerage.name ?? '',
        'metadata[brokerage_id]': brokerageId,
      });
      customerId = customer.id;
      await supabaseAdmin
        .from('brokerages')
        .update({ stripe_customer_id: customerId })
        .eq('id', brokerageId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create Stripe customer';
      console.error('[POST /api/billing/checkout] create customer:', msg);
      return NextResponse.json({ error: msg }, { status: 502 });
    }
  }

  // Create Checkout session.
  try {
    const session = await stripePost<StripeCheckoutSession>('checkout/sessions', {
      customer:                            customerId,
      mode:                                'subscription',
      'line_items[0][price]':              priceId,
      'line_items[0][quantity]':           quantity,
      // Store plan key on the subscription so the webhook can read it back.
      'subscription_data[metadata][billing_plan]': plan,
      success_url:                         `${appUrl}/settings?billing_success=1`,
      cancel_url:                          `${appUrl}/settings?billing_canceled=1`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to create checkout session';
    console.error('[POST /api/billing/checkout] create session:', msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
