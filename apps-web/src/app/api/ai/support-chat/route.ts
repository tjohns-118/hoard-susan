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
import { callOpenAI, SYSTEM_PROMPTS } from '@/lib/ai/hoardIdentity';

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

  // Build a single userPrompt from the full conversation so callOpenAI can handle it.
  // Format: "User: ...\nAssistant: ...\nUser: ..."
  const userPrompt = messages
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n');

  const reply = await callOpenAI({
    systemPrompt: SYSTEM_PROMPTS.supportChat,
    userPrompt,
    json:         false,
    maxTokens:    300,
    temperature:  0.4,
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
