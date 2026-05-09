/**
 * GET /api/sms/config — server-side Twilio configuration diagnostic.
 *
 * Returns boolean flags only — no credential values are exposed.
 * Requires broker or admin role.
 */

import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/getSessionUser';
import { getMembership } from '@/lib/getMembership';
import { detectCredentialMode } from '@/lib/sms/provider';

export async function GET() {
  const sessionUser = await getSessionUser();
  if (!sessionUser)
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  const membership = await getMembership(sessionUser.id, sessionUser.email);
  if (!membership)
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  if (membership.role !== 'broker' && membership.role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const hasAccountSid          = Boolean(process.env.TWILIO_ACCOUNT_SID?.trim());
  const hasAuthToken           = Boolean(process.env.TWILIO_AUTH_TOKEN?.trim());
  const hasApiKeySid           = Boolean(process.env.TWILIO_API_KEY_SID?.trim());
  const hasApiKeySecret        = Boolean(process.env.TWILIO_API_KEY_SECRET?.trim());
  const hasMessagingServiceSid = Boolean(process.env.TWILIO_MESSAGING_SERVICE_SID?.trim());
  const hasPhoneNumber         = Boolean(process.env.TWILIO_PHONE_NUMBER?.trim());

  const activeCredentialMode = detectCredentialMode();
  const credentialsPresent   = activeCredentialMode !== 'none';
  const senderPresent        = hasMessagingServiceSid || hasPhoneNumber;

  let activeSenderMode: 'messaging_service' | 'phone_number' | 'none' = 'none';
  if (credentialsPresent) {
    if (hasMessagingServiceSid) activeSenderMode = 'messaging_service';
    else if (hasPhoneNumber)    activeSenderMode = 'phone_number';
  }

  let configError: string | null = null;
  if (!hasAccountSid) {
    configError = 'TWILIO_ACCOUNT_SID is not set';
  } else if (activeCredentialMode === 'none') {
    configError = 'Set TWILIO_AUTH_TOKEN or both TWILIO_API_KEY_SID and TWILIO_API_KEY_SECRET';
  } else if (!senderPresent) {
    configError = 'Set TWILIO_MESSAGING_SERVICE_SID or TWILIO_PHONE_NUMBER';
  }

  return NextResponse.json({
    hasTwilioAccountSid:          hasAccountSid,
    hasTwilioAuthToken:           hasAuthToken,
    hasTwilioApiKeySid:           hasApiKeySid,
    hasTwilioApiKeySecret:        hasApiKeySecret,
    hasTwilioMessagingServiceSid: hasMessagingServiceSid,
    hasTwilioPhoneNumber:         hasPhoneNumber,
    activeCredentialMode,
    activeSenderMode,
    configError,
    ready: credentialsPresent && senderPresent,
  });
}
