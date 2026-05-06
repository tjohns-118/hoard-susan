/**
 * GET /api/sms/config — server-side Twilio configuration diagnostic.
 *
 * Returns boolean flags only — no credential values are exposed.
 * Requires authentication (any valid session).
 */

import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/getSessionUser';

export async function GET() {
  const sessionUser = await getSessionUser();
  if (!sessionUser)
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const hasAccountSid         = Boolean(process.env.TWILIO_ACCOUNT_SID?.trim());
  const hasAuthToken          = Boolean(process.env.TWILIO_AUTH_TOKEN?.trim());
  const hasMessagingServiceSid = Boolean(process.env.TWILIO_MESSAGING_SERVICE_SID?.trim());
  const hasPhoneNumber        = Boolean(process.env.TWILIO_PHONE_NUMBER?.trim());

  const credentialsPresent = hasAccountSid && hasAuthToken;
  const senderPresent      = hasMessagingServiceSid || hasPhoneNumber;

  let activeSenderMode: 'messaging_service' | 'phone_number' | 'none' = 'none';
  if (credentialsPresent) {
    if (hasMessagingServiceSid) activeSenderMode = 'messaging_service';
    else if (hasPhoneNumber)    activeSenderMode = 'phone_number';
  }

  let configError: string | null = null;
  if (!hasAccountSid)  configError = 'TWILIO_ACCOUNT_SID is not set';
  else if (!hasAuthToken) configError = 'TWILIO_AUTH_TOKEN is not set';
  else if (!senderPresent) configError = 'Set TWILIO_MESSAGING_SERVICE_SID or TWILIO_PHONE_NUMBER';

  return NextResponse.json({
    hasTwilioAccountSid:          hasAccountSid,
    hasTwilioAuthToken:           hasAuthToken,
    hasTwilioMessagingServiceSid: hasMessagingServiceSid,
    hasTwilioPhoneNumber:         hasPhoneNumber,
    activeSenderMode,
    configError,
    ready: credentialsPresent && senderPresent,
  });
}
