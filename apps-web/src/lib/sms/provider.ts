/**
 * SMS provider abstraction — Twilio only for V1.
 * All Twilio credentials are read server-side; none are returned to the client.
 *
 * Env vars (all required together):
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_AUTH_TOKEN
 *   TWILIO_MESSAGING_SERVICE_SID   (preferred — handles number pooling & compliance)
 *   TWILIO_PHONE_NUMBER            (fallback if no messaging service SID)
 *
 * Preference order: MessagingServiceSid > From number.
 * If neither TWILIO_MESSAGING_SERVICE_SID nor TWILIO_PHONE_NUMBER is set,
 * sendSms() returns a failure — it never sends without a known sender.
 */

export type SmsProvider = 'twilio' | 'none';

export interface SmsPayload {
  to:   string;
  body: string;
}

export interface SmsSendResult {
  provider:    SmsProvider;
  success:     boolean;
  messageId?:  string;
  error?:      string;
}

export function detectSmsProvider(): SmsProvider {
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) return 'twilio';
  return 'none';
}

async function sendViaTwilio(payload: SmsPayload): Promise<Omit<SmsSendResult, 'provider'>> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID!;
  const authToken  = process.env.TWILIO_AUTH_TOKEN!;

  // Prefer MessagingServiceSid (supports number pooling and 10DLC compliance).
  // Fall back to a specific From number for development/simple setups.
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID?.trim();
  const fromNumber          = process.env.TWILIO_PHONE_NUMBER?.trim();

  if (!messagingServiceSid && !fromNumber) {
    return { success: false, error: 'Set TWILIO_MESSAGING_SERVICE_SID or TWILIO_PHONE_NUMBER' };
  }

  const params = new URLSearchParams({
    To:   payload.to,
    Body: payload.body,
    ...(messagingServiceSid
      ? { MessagingServiceSid: messagingServiceSid }
      : { From: fromNumber! }),
  });

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method:  'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
          'Content-Type':  'application/x-www-form-urlencoded',
        },
        body:   params.toString(),
        signal: AbortSignal.timeout(10_000),
      },
    );

    const data: any = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg = data?.message ?? `Twilio error ${res.status} (code ${data?.code ?? 'unknown'})`;
      return { success: false, error: msg };
    }

    return { success: true, messageId: data?.sid };
  } catch (err: any) {
    return { success: false, error: err?.message ?? 'SMS provider request failed' };
  }
}

export async function sendSms(payload: SmsPayload): Promise<SmsSendResult> {
  const provider = detectSmsProvider();
  if (provider === 'none') {
    return {
      provider: 'none',
      success:  false,
      error:    'No SMS provider configured (set TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN)',
    };
  }
  const result = await sendViaTwilio(payload);
  return { provider: 'twilio', ...result };
}
