import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/getSessionUser';
import { getMembership } from '@/lib/getMembership';

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const membership = await getMembership(user.id, user.email);
  if (!membership) return NextResponse.json({ error: 'No brokerage membership found' }, { status: 403 });

  return NextResponse.json({
    userId:      user.id,
    email:       user.email,
    brokerageId: membership.brokerageId,
    role:        membership.role,
    memberId:    membership.memberId,
  });
}
