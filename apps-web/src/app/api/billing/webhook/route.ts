/**
 * POST /api/billing/webhook — receive and verify Stripe webhook events.
 *
 * IMPORTANT: This route reads the raw request body for signature verification.
 * Never call req.json() before verification — it changes the body stream.
 *
 * Handles:
 *   checkout.session.completed         → persist customer + subscription IDs
 *   customer.subscription.created      → set status + period end
 *   customer.subscription.updated      → update status + period end
 *   customer.subscription.deleted      → mark canceled
 *   invoice.payment_failed             → mark past_due
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { verifyStripeWebhook } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

// ── Stripe event shape (minimal typing) ──────────────────────────────────────

interface StripeCheckoutSession {
  customer?:      string;
  subscription?:  string;
  customer_email?: string;
}

interface StripeSubscription {
  id:                  string;
  customer:            string;
  status:              string;
  current_period_end:  number; // unix timestamp
}

interface StripeInvoice {
  customer:     string;
  subscription?: string;
}

interface StripeEvent {
  id:   string;
  type: string;
  data: { object: Record<string, unknown> };
}

// ── DB helpers ────────────────────────────────────────────────────────────────

async function brokerageByCustomer(customerId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('brokerages')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();
  return data?.id ? String(data.id) : null;
}

async function updateBilling(
  brokerageId: string,
  fields: {
    stripe_subscription_id?:           string | null;
    subscription_status?:              string;
    subscription_current_period_end?:  string | null;
    stripe_customer_id?:               string;
    billing_email?:                    string;
  },
) {
  const { error } = await supabaseAdmin
    .from('brokerages')
    .update(fields)
    .eq('id', brokerageId);
  if (error) console.error('[webhook] DB update error:', error.message);
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    console.error('[webhook] STRIPE_WEBHOOK_SECRET is not set');
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
  }

  const rawBody  = await req.text();
  const sigHeader = req.headers.get('stripe-signature') ?? '';

  if (!verifyStripeWebhook(rawBody, sigHeader, secret)) {
    console.warn('[webhook] Invalid Stripe signature');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(rawBody) as StripeEvent;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  console.log(`[webhook] ${event.type} id=${event.id}`);

  try {
    switch (event.type) {

      case 'checkout.session.completed': {
        const session = event.data.object as StripeCheckoutSession;
        const customerId     = session.customer;
        const subscriptionId = session.subscription;
        if (!customerId) break;

        // The checkout session may arrive before the subscription.created event.
        // We persist what we have; subscription events will fill in the rest.
        const brokerageId = await brokerageByCustomer(customerId);
        if (!brokerageId) {
          // Customer was just created — update by ID directly using stripe_customer_id
          // (already saved at checkout session creation time).
          break;
        }
        await updateBilling(brokerageId, {
          stripe_subscription_id: subscriptionId ?? null,
          subscription_status:    'active',
          ...(session.customer_email ? { billing_email: session.customer_email } : {}),
        });
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub        = event.data.object as unknown as StripeSubscription;
        const brokerageId = await brokerageByCustomer(sub.customer);
        if (!brokerageId) {
          console.warn(`[webhook] ${event.type}: no brokerage for customer ${sub.customer}`);
          break;
        }
        const periodEnd = sub.current_period_end
          ? new Date(sub.current_period_end * 1000).toISOString()
          : null;
        await updateBilling(brokerageId, {
          stripe_subscription_id:          sub.id,
          subscription_status:             sub.status,
          subscription_current_period_end: periodEnd,
        });
        break;
      }

      case 'customer.subscription.deleted': {
        const sub        = event.data.object as unknown as StripeSubscription;
        const brokerageId = await brokerageByCustomer(sub.customer);
        if (!brokerageId) break;
        await updateBilling(brokerageId, {
          subscription_status:             'canceled',
          subscription_current_period_end: null,
        });
        break;
      }

      case 'invoice.payment_failed': {
        const invoice    = event.data.object as unknown as StripeInvoice;
        const brokerageId = await brokerageByCustomer(invoice.customer);
        if (!brokerageId) break;
        await updateBilling(brokerageId, { subscription_status: 'past_due' });
        break;
      }

      default:
        // Unhandled event types are silently acknowledged.
        break;
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[webhook] Error handling ${event.type}:`, msg);
    // Return 200 so Stripe doesn't retry — the error is ours to investigate.
  }

  return NextResponse.json({ received: true });
}
