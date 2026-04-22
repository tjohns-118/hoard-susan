import { cookies } from 'next/headers';
import { createSupabaseServerClient } from '@/lib/supabaseServer';

export type SessionUser = {
  id:    string;
  email: string;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const supabase    = createSupabaseServerClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;
  return { id: user.id, email: user.email };
}
