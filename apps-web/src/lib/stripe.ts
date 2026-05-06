/**
 * Thin Stripe REST helper — no SDK dependency.
 * Secret key is read server-side only; never returned to the client.
 *
 * Stripe API ref: https://stripe.com/docs/api
 */

import { createHmac, timingSafeEqual } from 'crypto';

const STRIPE_BASE    = 'https://api.stripe.com/v1';
const STRIPE_VERSION = '2024-06-20';
const TOLERANCE_S    = 300; // reject webhooks older than 5 min

// ── Auth header ───────────────────────────────────────────────────────────────

function authHeader(): string {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
  return `Basic ${Buffer.from(`${key}:`).toString('base64')}`;
}

// ── Request helpers ───────────────────────────────────────────────────────────

export async function stripePost<T = Record<string, unknown>>(
  path: string,
  params: Record<string, string>,
): Promise<T> {
  const res = await fetch(`${STRIPE_BASE}/${path}`, {
    method:  'POST',
    headers: {
      Authorization:  authHeader(),
      'Content-Type': 'application/x-www-form-urlencoded',
      'Stripe-Version': STRIPE_VERSION,
    },
    body: new URLSearchParams(params).toString(),
  });
  const data = await res.json() as { error?: { message?: string } };
  if (!res.ok) throw new Error(data?.error?.message ?? `Stripe error ${res.status}`);
  return data as T;
}

// ── Webhook signature verification ────────────────────────────────────────────

export function verifyStripeWebhook(
  rawBody:   string,
  sigHeader: string,
  secret:    string,
): boolean {
  // Header format: "t=1234567890,v1=abc...,v0=..."
  const pairs: Record<string, string> = {};
  for (const part of sigHeader.split(',')) {
    const idx = part.indexOf('=');
    if (idx > 0) pairs[part.slice(0, idx)] = part.slice(idx + 1);
  }

  const timestamp = pairs['t'];
  const v1        = pairs['v1'];
  if (!timestamp || !v1) return false;

  // Reject stale payloads
  const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (ageSeconds > TOLERANCE_S) return false;

  const expected = createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');

  const bufExpected = Buffer.from(expected, 'hex');
  const bufReceived = Buffer.from(v1,       'hex');
  if (bufExpected.length !== bufReceived.length) return false;

  return timingSafeEqual(bufExpected, bufReceived);
}
