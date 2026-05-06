/**
 * Email provider abstraction — Resend preferred, SendGrid fallback.
 * All provider-specific code is isolated here so switching is a single-file change.
 *
 * Env vars (Resend):
 *   RESEND_API_KEY
 *   RESEND_FROM_EMAIL   (default: noreply@use-hoard.com) — must be a full email address
 *   RESEND_FROM_NAME    (default: Hoard)
 *
 * Env vars (SendGrid):
 *   SENDGRID_API_KEY
 *   SENDGRID_FROM_EMAIL (default: noreply@use-hoard.com)
 *   SENDGRID_FROM_NAME  (default: Hoard)
 */

export type EmailProvider = 'resend' | 'sendgrid' | 'none';

const FROM_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface EmailPayload {
  to:      string;
  subject: string;
  html:    string;
  text?:   string;
}

export interface SendResult {
  provider:    EmailProvider;
  success:     boolean;
  messageId?:  string;
  error?:      string;
}

export function detectProvider(): EmailProvider {
  if (process.env.RESEND_API_KEY)   return 'resend';
  if (process.env.SENDGRID_API_KEY) return 'sendgrid';
  return 'none';
}

/**
 * Logs which email-related env vars are present as booleans.
 * Never logs actual values — safe to call in any server context.
 */
export function logProviderDiagnostics(): void {
  console.log('[email/provider] env check:', {
    has_RESEND_API_KEY:      !!process.env.RESEND_API_KEY,
    has_RESEND_FROM_EMAIL:   !!process.env.RESEND_FROM_EMAIL,
    has_RESEND_FROM_NAME:    !!process.env.RESEND_FROM_NAME,
    has_SENDGRID_API_KEY:    !!process.env.SENDGRID_API_KEY,
    has_SENDGRID_FROM_EMAIL: !!process.env.SENDGRID_FROM_EMAIL,
    has_SENDGRID_FROM_NAME:  !!process.env.SENDGRID_FROM_NAME,
  });
}

/**
 * Returns null if the email configuration is valid.
 * Returns a human-readable error string if something is wrong —
 * the string is safe to surface in API error responses (no secrets).
 */
export function getConfigError(): string | null {
  if (process.env.RESEND_API_KEY) {
    const fromEmail = process.env.RESEND_FROM_EMAIL ?? '';
    if (fromEmail && !FROM_EMAIL_RE.test(fromEmail)) {
      return (
        'RESEND_FROM_EMAIL must be a full email address ' +
        '(e.g. noreply@newsletter.use-hoard.com) — ' +
        `"${fromEmail}" is not a valid address`
      );
    }
    return null;
  }

  if (process.env.SENDGRID_API_KEY) {
    return null;
  }

  return 'Email provider not configured — set RESEND_API_KEY or SENDGRID_API_KEY';
}

async function sendViaResend(payload: EmailPayload): Promise<Omit<SendResult, 'provider'>> {
  const apiKey    = process.env.RESEND_API_KEY!;
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'noreply@use-hoard.com';
  const fromName  = process.env.RESEND_FROM_NAME  ?? 'Hoard';

  const res = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from:    `${fromName} <${fromEmail}>`,
      to:      payload.to,
      subject: payload.subject,
      html:    payload.html,
      ...(payload.text ? { text: payload.text } : {}),
    }),
    signal: AbortSignal.timeout(10000),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data as any)?.message ?? (data as any)?.name ?? `Resend error ${res.status}`;
    return { success: false, error: msg };
  }
  return { success: true, messageId: (data as any)?.id };
}

async function sendViaSendGrid(payload: EmailPayload): Promise<Omit<SendResult, 'provider'>> {
  const apiKey    = process.env.SENDGRID_API_KEY!;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL ?? 'noreply@use-hoard.com';
  const fromName  = process.env.SENDGRID_FROM_NAME  ?? 'Hoard';

  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: payload.to }] }],
      from:             { email: fromEmail, name: fromName },
      subject:          payload.subject,
      content: [
        { type: 'text/html',  value: payload.html },
        ...(payload.text ? [{ type: 'text/plain', value: payload.text }] : []),
      ],
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (res.status === 202) {
    return { success: true, messageId: res.headers.get('X-Message-Id') ?? undefined };
  }

  let errMsg = `SendGrid error ${res.status}`;
  try {
    const d: any = await res.json();
    errMsg = d?.errors?.[0]?.message ?? errMsg;
  } catch {}
  return { success: false, error: errMsg };
}

export async function sendEmail(payload: EmailPayload): Promise<SendResult> {
  const provider = detectProvider();

  if (provider === 'none') {
    return { provider: 'none', success: false, error: 'No email provider configured (set RESEND_API_KEY or SENDGRID_API_KEY)' };
  }

  const result = provider === 'resend'
    ? await sendViaResend(payload)
    : await sendViaSendGrid(payload);

  return { provider, ...result };
}
