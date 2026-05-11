/**
 * POST /api/ai/support-chat
 *
 * Stateless help chat — no DB storage.
 * Accepts the current conversation and returns the next assistant reply.
 *
 * Body: { messages: { role: 'user' | 'assistant'; content: string }[] }
 * Response: { reply: string } | { error: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/getSessionUser';
import { getMembership } from '@/lib/getMembership';
import { callOpenAI, buildSupportChatPrompt } from '@/lib/ai/hoardIdentity';

const MAX_MESSAGES = 20; // cap context window

export async function POST(req: NextRequest) {
  const sessionUser = await getSessionUser();
  if (!sessionUser)
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const body = await req.json() as {
    messages?: { role: string; content: string }[];
  };

  const messages = (body.messages ?? []).slice(-MAX_MESSAGES);
  if (!messages.length || messages[messages.length - 1]?.role !== 'user')
    return NextResponse.json({ error: 'Last message must be from user' }, { status: 400 });

  const lastUserMsg = messages[messages.length - 1].content?.trim() ?? '';
  if (!lastUserMsg)
    return NextResponse.json({ error: 'Empty message' }, { status: 400 });

  // Resolve role for product-map filtering (agent sees fewer sections than broker).
  // Falls back to 'agent' if membership lookup fails — never exposes broker-only info to unknown roles.
  const membership = await getMembership(sessionUser.id, sessionUser.email).catch(() => null);
  const role: 'broker' | 'agent' | 'admin' =
    membership?.role === 'broker' ? 'broker'
    : membership?.role === 'admin' ? 'admin'
    : 'agent';

  // Build a single userPrompt from the full conversation so callOpenAI can handle it.
  // Format: "User: ...\nAssistant: ...\nUser: ..."
  const userPrompt = messages
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n');

  const reply = await callOpenAI({
    systemPrompt: buildSupportChatPrompt(role),
    userPrompt,
    json:         false,
    maxTokens:    350,
    temperature:  0.3,
    timeoutMs:    12_000,
  });

  if (!reply) {
    return NextResponse.json(
      { error: 'AI assistance is temporarily unavailable. Please describe your issue using the Report an Issue tab.' },
      { status: 503 },
    );
  }

  return NextResponse.json({ reply });
}
