/**
 * GET /api/ai/agent-summary
 *
 * Returns a structured AI analysis of the authenticated agent's current pipeline.
 * Broker access is intentionally excluded in V1 — brokers have their own overview.
 *
 * Response shape:
 *   {
 *     today_focus:   string[]           // up to 5 action items
 *     at_risk_deals: AtRiskDeal[]       // up to 3 deals needing attention
 *     quick_wins:    QuickWin[]         // up to 3 near-close opportunities
 *   }
 *
 * On any failure (AI timeout, bad response, unconfigured key) the endpoint returns:
 *   { error: 'unavailable' }
 * — the client renders a static fallback, never surfaces the raw error.
 *
 * Data fed to OpenAI is read-only. The model has no ability to mutate data.
 * No user-identifiable information beyond names and deal metadata is sent.
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { getBrokerageId } from '@/lib/getBrokerageId';
import { getSessionUser } from '@/lib/getSessionUser';
import { getMembership } from '@/lib/getMembership';

export const dynamic = 'force-dynamic';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AtRiskDeal {
  name:   string;
  reason: string;
  value:  number;
}

interface QuickWin {
  name:   string;
  reason: string;
  value:  string;
}

export interface AgentSummary {
  today_focus:   string[];
  at_risk_deals: AtRiskDeal[];
  quick_wins:    QuickWin[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysSince(iso?: string | null): number {
  if (!iso) return 999;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function daysUntil(iso?: string | null): number {
  if (!iso) return 999;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

function fmtMoney(min: number, max?: number | null): string {
  const f = (v: number) =>
    v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(2)}M` : `$${Math.round(v / 1_000)}k`;
  if (!max || max <= min) return f(min);
  return `${f(min)}–${f(max)}`;
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function GET() {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const sessionUser = await getSessionUser();
  if (!sessionUser) return NextResponse.json({ error: 'unavailable' }, { status: 401 });

  const BROKERAGE_ID = await getBrokerageId();
  if (!BROKERAGE_ID)  return NextResponse.json({ error: 'unavailable' }, { status: 503 });

  const membership = await getMembership(sessionUser.id, sessionUser.email);
  if (!membership)    return NextResponse.json({ error: 'unavailable' }, { status: 403 });

  // Broker AI summary is not implemented in V1 — brokers see all agents' data
  // and need a different prompt shape. Return unavailable rather than 403 so
  // the broker dashboard renders its standard fallback without an error flash.
  if (membership.role !== 'agent')
    return NextResponse.json({ error: 'unavailable' });

  if (!process.env.OPENAI_API_KEY)
    return NextResponse.json({ error: 'unavailable' });

  const memberId = membership.memberId;

  // ── Fetch agent-scoped data from Supabase ────────────────────────────────────
  const now = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  const [oppsRes, leadsRes, contactsRes, tasksRes] = await Promise.all([
    supabaseAdmin
      .from('opportunities')
      .select('id, title, stage, pipeline_type, value, value_min, value_max, probability, expected_close_date, updated_at, stage_updated_at')
      .eq('brokerage_id', BROKERAGE_ID)
      .eq('assigned_member_id', memberId)
      .not('stage', 'in', '(closed,lost,post_close_followup)')
      .limit(40),

    supabaseAdmin
      .from('leads')
      .select('id, full_name, status, tags, updated_at, created_at')
      .eq('brokerage_id', BROKERAGE_ID)
      .eq('assigned_to_member_id', memberId)
      .neq('status', 'lost')
      .limit(40),

    supabaseAdmin
      .from('contacts')
      .select('id, full_name, status, tags, updated_at')
      .eq('brokerage_id', BROKERAGE_ID)
      .eq('assigned_to_member_id', memberId)
      .limit(40),

    supabaseAdmin
      .from('tasks')
      .select('id, title, priority, due_at, completed, opportunity_id, lead_id, contact_id')
      .eq('brokerage_id', BROKERAGE_ID)
      .eq('completed', false)
      .limit(60),
  ]);

  const opps     = oppsRes.data     ?? [];
  const leads    = leadsRes.data    ?? [];
  const contacts = contactsRes.data ?? [];
  const allTasks = tasksRes.data    ?? [];

  // Filter tasks to those linked to this agent's records
  const oppIds     = new Set(opps.map((o: any) => o.id));
  const leadIds    = new Set(leads.map((l: any) => l.id));
  const contactIds = new Set(contacts.map((c: any) => c.id));
  const myTasks = allTasks.filter((t: any) =>
    (t.opportunity_id && oppIds.has(t.opportunity_id)) ||
    (t.lead_id        && leadIds.has(t.lead_id))       ||
    (t.contact_id     && contactIds.has(t.contact_id)),
  );

  const overdueTasks = myTasks.filter((t: any) => t.due_at && t.due_at.slice(0, 10) < now);
  const highPriTasks = myTasks.filter((t: any) => t.priority === 'high');

  // Early-exit: no data to analyse
  if (opps.length === 0 && leads.length === 0 && myTasks.length === 0) {
    return NextResponse.json({
      today_focus:   ['Your pipeline is empty — time to generate new leads.'],
      at_risk_deals: [],
      quick_wins:    [],
    });
  }

  // ── Build concise prompt context ────────────────────────────────────────────
  // Data is serialised as terse lines, not JSON blobs, to keep token count low.

  const oppLines = opps.slice(0, 15).map((o: any) => {
    const stale = daysSince(o.stage_updated_at ?? o.updated_at);
    const close = daysUntil(o.expected_close_date);
    const val   = fmtMoney(o.value_min ?? o.value ?? 0, o.value_max);
    return `  • Deal: "${o.title}" stage=${o.stage} value=${val} prob=${o.probability}% close_in=${close}d stale=${stale}d`;
  });

  const leadLines = leads.slice(0, 10).map((l: any) => {
    const hot   = (l.tags ?? []).includes('hot') ? ' [HOT]' : '';
    const stale = daysSince(l.updated_at);
    return `  • Lead: "${l.full_name}"${hot} status=${l.status} last_touch=${stale}d_ago`;
  });

  const taskLines = [
    ...overdueTasks.slice(0, 5).map((t: any) => {
      const over = Math.floor((Date.now() - new Date(t.due_at).getTime()) / 86_400_000);
      return `  • OVERDUE task: "${t.title}" (${over}d overdue, priority=${t.priority})`;
    }),
    ...highPriTasks.filter((t: any) => !t.due_at || t.due_at.slice(0, 10) >= now).slice(0, 3).map((t: any) =>
      `  • High-priority task: "${t.title}"`,
    ),
  ];

  const contextBlock = [
    `Today: ${now}`,
    opps.length    > 0 ? `\nActive deals (${opps.length} total):\n${oppLines.join('\n')}` : '',
    leads.length   > 0 ? `\nLeads (${leads.length} total):\n${leadLines.join('\n')}` : '',
    myTasks.length > 0 ? `\nTasks (${myTasks.length} open, ${overdueTasks.length} overdue):\n${taskLines.join('\n')}` : '',
  ].filter(Boolean).join('\n');

  // ── Call OpenAI ─────────────────────────────────────────────────────────────
  const systemPrompt = `You are a concise real-estate sales assistant. You analyse an agent's live pipeline data and return a JSON object with exactly these three keys:

"today_focus"   — array of 3–5 short, specific action strings. Each must name a real person or deal. No generic advice.
"at_risk_deals" — array of 0–3 objects: { name, reason, value }. Only include truly at-risk items (stale > 5 days, close < 7 days with low probability, overdue tasks). value is a number (dollars).
"quick_wins"    — array of 0–3 objects: { name, reason, value }. Deals with high probability or motivated leads close to decision. value is a string (e.g. "$450k–$550k").

Rules:
- Use the exact names from the data. Never invent names or values.
- Keep every string under 100 characters.
- Do not explain yourself. Return only the JSON object.
- If a section is empty, return an empty array.
- Do not include markdown fences.`;

  const userPrompt = `Here is my pipeline data:\n\n${contextBlock}\n\nReturn the JSON summary.`;

  try {
    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model:           'gpt-4o-mini',
        response_format: { type: 'json_object' },
        temperature:     0.3,
        max_tokens:      600,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userPrompt   },
        ],
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!aiRes.ok) {
      console.warn(`[agent-summary] OpenAI error ${aiRes.status}`);
      return NextResponse.json({ error: 'unavailable' });
    }

    const aiJson = await aiRes.json();
    const raw    = aiJson?.choices?.[0]?.message?.content ?? '';

    let parsed: AgentSummary;
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.warn('[agent-summary] JSON parse failed:', raw.slice(0, 200));
      return NextResponse.json({ error: 'unavailable' });
    }

    // Validate + clamp the response shape to prevent unexpected client rendering.
    const summary: AgentSummary = {
      today_focus:   Array.isArray(parsed.today_focus)   ? parsed.today_focus.slice(0, 5).map(String)   : [],
      at_risk_deals: Array.isArray(parsed.at_risk_deals) ? parsed.at_risk_deals.slice(0, 3).filter(
        (d: any) => d && typeof d.name === 'string',
      ) : [],
      quick_wins: Array.isArray(parsed.quick_wins) ? parsed.quick_wins.slice(0, 3).filter(
        (w: any) => w && typeof w.name === 'string',
      ) : [],
    };

    return NextResponse.json(summary);
  } catch (err: any) {
    console.warn('[agent-summary] AI call failed:', err?.message ?? err);
    return NextResponse.json({ error: 'unavailable' });
  }
}
