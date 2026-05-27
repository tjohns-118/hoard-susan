/**
 * POST /api/billing/portal — create a Stripe Customer Portal session.
 *
 * Broker-only. Requires an existing Stripe customer (created at checkout).
 * Returns the hosted portal URL where the broker manages payment details,
 * invoices, and subscription changes.
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { getSessionUser } from '@/lib/getSessionUser';
import { getMembership } from '@/lib/getMembership';
import { getBrokerageId } from '@/lib/getBrokerageId';
import { stripePost } from '@/lib/stripe';

interface StripeBillingPortalSession { id: string; url: string }

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

  const { data: brokerage, error: dbErr } = await supabaseAdmin
    .from('brokerages')
    .select('stripe_customer_id, is_demo')
    .eq('id', brokerageId)
    .maybeSingle();

  if (dbErr || !brokerage)
    return NextResponse.json({ error: 'Failed to load brokerage' }, { status: 500 });

  if (brokerage.is_demo)
    return NextResponse.json({ error: 'Billing is disabled in demo mode.' }, { status: 403 });

  const customerId = brokerage.stripe_customer_id as string | null;
  if (!customerId)
    return NextResponse.json({ error: 'No billing account found. Please subscribe first.' }, { status: 400 });

  const appUrl    = process.env.NEXT_PUBLIC_APP_URL?.trim() ?? '';
  const returnUrl = process.env.STRIPE_CUSTOMER_PORTAL_RETURN_URL?.trim()
    || `${appUrl}/settings`;

  try {
    const portal = await stripePost<StripeBillingPortalSession>('billing_portal/sessions', {
      customer:   customerId,
      return_url: returnUrl,
    });

    return NextResponse.json({ url: portal.url });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to create portal session';
    console.error('[POST /api/billing/portal]', msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
