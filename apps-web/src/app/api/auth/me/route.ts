import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { getSessionUser } from '@/lib/getSessionUser';
import { getMembership } from '@/lib/getMembership';

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  // getMembership also triggers lazy auth_user_id linking on first login.
  const membership = await getMembership(user.id, user.email);
  if (!membership) return NextResponse.json({ error: 'No brokerage membership found' }, { status: 403 });

  // Fetch phone + SMS prefs — fail open so a missing column never breaks auth.
  const { data: appUser } = await supabaseAdmin
    .from('app_users')
    .select('phone, sms_reminders_enabled')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  return NextResponse.json({
    userId:              user.id,
    email:               user.email,
    brokerageId:         membership.brokerageId,
    role:                membership.role,
    memberId:            membership.memberId,
    phone:               (appUser?.phone as string | null)              ?? null,
    smsRemindersEnabled: (appUser?.sms_reminders_enabled as boolean | null) ?? true,
  });
}
