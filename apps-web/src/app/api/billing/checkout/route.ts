/**
 * POST /api/billing/checkout — create a Stripe Checkout session.
 *
 * Broker-only. Creates or reuses a Stripe customer, then creates a
 * subscription checkout session and returns the hosted URL.
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { getSessionUser } from '@/lib/getSessionUser';
import { getMembership } from '@/lib/getMembership';
import { getBrokerageId } from '@/lib/getBrokerageId';
import { stripePost } from '@/lib/stripe';

interface StripeCustomer { id: string }
interface StripeCheckoutSession { id: string; url: string }

export async function POST() {
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

  const priceId = process.env.STRIPE_PRICE_ID?.trim();
  const appUrl  = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!priceId) return NextResponse.json({ error: 'STRIPE_PRICE_ID is not configured' }, { status: 503 });
  if (!appUrl)  return NextResponse.json({ error: 'NEXT_PUBLIC_APP_URL is not configured' }, { status: 503 });

  // Load brokerage to check for existing Stripe customer
  const { data: brokerage, error: dbErr } = await supabaseAdmin
    .from('brokerages')
    .select('id, name, billing_email, stripe_customer_id')
    .eq('id', brokerageId)
    .maybeSingle();

  if (dbErr || !brokerage)
    return NextResponse.json({ error: 'Failed to load brokerage' }, { status: 500 });

  let customerId = brokerage.stripe_customer_id as string | null;

  // Create Stripe customer if none exists
  if (!customerId) {
    try {
      const customer = await stripePost<StripeCustomer>('customers', {
        email:                   sessionUser.email,
        name:                    brokerage.name ?? '',
        'metadata[brokerage_id]': brokerageId,
      });
      customerId = customer.id;

      // Persist customer ID immediately so it survives even if checkout is abandoned
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

  // Create Checkout session
  try {
    const session = await stripePost<StripeCheckoutSession>('checkout/sessions', {
      customer:                 customerId,
      mode:                     'subscription',
      'line_items[0][price]':   priceId,
      'line_items[0][quantity]': '1',
      success_url:              `${appUrl}/billing?success=1`,
      cancel_url:               `${appUrl}/billing?canceled=1`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to create checkout session';
    console.error('[POST /api/billing/checkout] create session:', msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
