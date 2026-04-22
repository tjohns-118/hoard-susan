import { supabaseAdmin } from '@/lib/supabaseServer';

export type Membership = {
  memberId:    string;
  brokerageId: string;
  role:        'broker' | 'agent' | 'admin';
};

export async function getMembership(authUserId: string, email: string): Promise<Membership | null> {
  // Try direct auth_user_id lookup first.
  let { data: appUser } = await supabaseAdmin
    .from('app_users')
    .select('id')
    .eq('auth_user_id', authUserId)
    .maybeSingle();

  // Lazy link: on first login, match by email and write auth_user_id.
  if (!appUser) {
    const { data: byEmail } = await supabaseAdmin
      .from('app_users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (byEmail) {
      await supabaseAdmin
        .from('app_users')
        .update({ auth_user_id: authUserId })
        .eq('id', byEmail.id);
      appUser = byEmail;
    }
  }

  if (!appUser) return null;

  const { data: member } = await supabaseAdmin
    .from('brokerage_members')
    .select('id, brokerage_id, role')
    .eq('user_id', appUser.id)
    .eq('is_active', true)
    .maybeSingle();

  if (!member) return null;

  return {
    memberId:    String(member.id),
    brokerageId: String(member.brokerage_id),
    role:        member.role as Membership['role'],
  };
}
