/**
 * SMS provider abstraction — Twilio only for V1.
 * All Twilio credentials are read server-side; none are returned to the client.
 *
 * Credential modes (checked in order):
 *   API Key  — TWILIO_ACCOUNT_SID + TWILIO_API_KEY_SID + TWILIO_API_KEY_SECRET
 *   Auth Token — TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN
 *
 * Sender (required regardless of credential mode):
 *   TWILIO_MESSAGING_SERVICE_SID   (preferred — handles number pooling & 10DLC compliance)
 *   TWILIO_PHONE_NUMBER            (fallback for simple setups)
 */

export type SmsProvider      = 'twilio' | 'none';
export type CredentialMode   = 'api_key' | 'auth_token' | 'none';

export interface SmsPayload {
  to:   string;
  body: string;
}

export interface SmsSendResult {
  provider:       SmsProvider;
  success:        boolean;
  messageId?:     string;
  error?:         string;
  credentialMode?: CredentialMode;
}

export function detectCredentialMode(): CredentialMode {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  if (!accountSid) return 'none';
  if (process.env.TWILIO_API_KEY_SID?.trim() && process.env.TWILIO_API_KEY_SECRET?.trim()) return 'api_key';
  if (process.env.TWILIO_AUTH_TOKEN?.trim()) return 'auth_token';
  return 'none';
}

export function detectSmsProvider(): SmsProvider {
  return detectCredentialMode() !== 'none' ? 'twilio' : 'none';
}

async function sendViaTwilio(payload: SmsPayload): Promise<Omit<SmsSendResult, 'provider'>> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID!;
  const mode       = detectCredentialMode();

  if (mode === 'none') {
    return { success: false, error: 'No Twilio credentials configured' };
  }

  // Build Basic auth: API Key mode uses apiKeySid:apiKeySecret; Auth Token mode uses accountSid:authToken.
  const authUser   = mode === 'api_key' ? process.env.TWILIO_API_KEY_SID!    : accountSid;
  const authPass   = mode === 'api_key' ? process.env.TWILIO_API_KEY_SECRET! : process.env.TWILIO_AUTH_TOKEN!;

  // Prefer MessagingServiceSid (number pooling + 10DLC compliance).
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID?.trim();
  const fromNumber          = process.env.TWILIO_PHONE_NUMBER?.trim();

  if (!messagingServiceSid && !fromNumber) {
    return { success: false, error: 'Set TWILIO_MESSAGING_SERVICE_SID or TWILIO_PHONE_NUMBER', credentialMode: mode };
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
          'Authorization': `Basic ${Buffer.from(`${authUser}:${authPass}`).toString('base64')}`,
          'Content-Type':  'application/x-www-form-urlencoded',
        },
        body:   params.toString(),
        signal: AbortSignal.timeout(10_000),
      },
    );

    const data: any = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg = data?.message ?? `Twilio error ${res.status} (code ${data?.code ?? 'unknown'})`;
      return { success: false, error: msg, credentialMode: mode };
    }

    return { success: true, messageId: data?.sid, credentialMode: mode };
  } catch (err: any) {
    return { success: false, error: err?.message ?? 'SMS provider request failed', credentialMode: mode };
  }
}

export async function sendSms(payload: SmsPayload): Promise<SmsSendResult> {
  const provider = detectSmsProvider();
  if (provider === 'none') {
    return {
      provider:       'none',
      success:        false,
      credentialMode: 'none',
      error:          'No SMS provider configured — set TWILIO_ACCOUNT_SID with TWILIO_API_KEY_SID/SECRET or TWILIO_AUTH_TOKEN',
    };
  }
  const result = await sendViaTwilio(payload);
  return { provider: 'twilio', ...result };
}
