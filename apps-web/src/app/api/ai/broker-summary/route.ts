/**
 * GET /api/ai/broker-summary
 *
 * Returns a structured AI analysis of the brokerage's current state.
 * Broker-only — agents receive 403 (not 'unavailable') because this is an
 * intentional access boundary, not an availability issue.
 *
 * Response shape:
 *   {
 *     broker_briefing:     string[]              // 3–5 brokerage state sentences
 *     agent_attention:     AgentAttention[]      // agents needing broker action
 *     deal_risks:          DealRisk[]            // deals requiring intervention
 *     recommended_actions: string[]              // 3–5 specific next steps
 *   }
 *
 * On any AI failure (timeout, bad response, missing key):
 *   { error: 'unavailable' }
 * — client renders a static fallback, never surfaces the raw error.
 *
 * Data fed to OpenAI is read-only. No user-identifiable information beyond
 * names and deal metadata is sent. No mutations occur.
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { getBrokerageId } from '@/lib/getBrokerageId';
import { getSessionUser } from '@/lib/getSessionUser';
import { getMembership } from '@/lib/getMembership';

export const dynamic = 'force-dynamic';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AgentAttention {
  agent:    string;
  reason:   string;
  severity: 'normal' | 'high';
}

interface DealRisk {
  name:     string;
  reason:   string;
  value:    string;
  severity: 'normal' | 'high';
}

export interface BrokerSummary {
  broker_briefing:     string[];
  agent_attention:     AgentAttention[];
  deal_risks:          DealRisk[];
  recommended_actions: string[];
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
  if (!BROKERAGE_ID) return NextResponse.json({ error: 'unavailable' }, { status: 503 });

  const membership = await getMembership(sessionUser.id, sessionUser.email);
  if (!membership) return NextResponse.json({ error: 'unavailable' }, { status: 403 });

  // Intentional 403 — agents should not call this endpoint.
  if (membership.role !== 'broker')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (!process.env.OPENAI_API_KEY)
    return NextResponse.json({ error: 'unavailable' });

  // ── Fetch brokerage-scoped data ──────────────────────────────────────────────
  const now = new Date().toISOString().slice(0, 10);

  const [agentsRes, oppsRes, leadsRes, contactsRes, tasksRes] = await Promise.all([
    supabaseAdmin
      .from('brokerage_members')
      .select('id, full_name, role')
      .eq('brokerage_id', BROKERAGE_ID)
      .eq('active', true),

    supabaseAdmin
      .from('opportunities')
      .select('id, title, stage, pipeline_type, value, value_min, value_max, probability, expected_close_date, updated_at, stage_updated_at, assigned_member_id')
      .eq('brokerage_id', BROKERAGE_ID)
      .not('stage', 'in', '(closed,lost,post_close_followup)')
      .limit(60),

    supabaseAdmin
      .from('leads')
      .select('id, full_name, status, tags, updated_at, assigned_to_member_id')
      .eq('brokerage_id', BROKERAGE_ID)
      .neq('status', 'lost')
      .limit(60),

    supabaseAdmin
      .from('contacts')
      .select('id, assigned_to_member_id')
      .eq('brokerage_id', BROKERAGE_ID)
      .limit(100),

    supabaseAdmin
      .from('tasks')
      .select('id, title, priority, due_at, completed, opportunity_id, lead_id, contact_id')
      .eq('brokerage_id', BROKERAGE_ID)
      .eq('completed', false)
      .limit(80),
  ]);

  const agents   = (agentsRes.data   ?? []).filter((a: any) => a.role !== 'broker');
  const opps     = oppsRes.data      ?? [];
  const leads    = leadsRes.data     ?? [];
  const contacts = contactsRes.data  ?? [];
  const tasks    = tasksRes.data     ?? [];

  const overdueTasks = tasks.filter((t: any) => t.due_at && t.due_at.slice(0, 10) < now);

  // Early-exit: nothing to analyse yet
  if (opps.length === 0 && leads.length === 0 && agents.length === 0) {
    return NextResponse.json({
      broker_briefing:     ['Your brokerage pipeline is empty — start by adding agents and importing leads.'],
      agent_attention:     [],
      deal_risks:          [],
      recommended_actions: ['Add at least one agent', 'Import or capture your first lead'],
    });
  }

  // ── Build concise prompt context ────────────────────────────────────────────

  // Totals
  const totalPipelineMin = opps.reduce((s: number, o: any) => s + (o.value_min ?? o.value ?? 0), 0);
  const totalPipelineMax = opps.reduce((s: number, o: any) => s + (o.value_max ?? o.value_min ?? o.value ?? 0), 0);
  const unassignedLeads  = leads.filter((l: any) => !l.assigned_to_member_id);

  const summaryLine = [
    `Today: ${now}`,
    `Brokerage: ${agents.length} agent${agents.length !== 1 ? 's' : ''}, ${leads.length} active lead${leads.length !== 1 ? 's' : ''}, ${opps.length} open deal${opps.length !== 1 ? 's' : ''}`,
    `Pipeline: ${fmtMoney(totalPipelineMin, totalPipelineMax > totalPipelineMin ? totalPipelineMax : null)}`,
    unassignedLeads.length > 0 ? `Unassigned leads: ${unassignedLeads.length}` : '',
    overdueTasks.length > 0    ? `Overdue tasks: ${overdueTasks.length}`        : '',
  ].filter(Boolean).join('\n');

  // Per-agent breakdown
  const agentLines = agents.slice(0, 12).map((a: any) => {
    const agOpps     = opps.filter((o: any) => o.assigned_member_id === a.id);
    const agLeads    = leads.filter((l: any) => l.assigned_to_member_id === a.id);
    const agContacts = contacts.filter((c: any) => c.assigned_to_member_id === a.id);
    const oppIds     = new Set(agOpps.map((o: any) => o.id));
    const leadIds    = new Set(agLeads.map((l: any) => l.id));
    const agOverdue  = overdueTasks.filter((t: any) =>
      (t.opportunity_id && oppIds.has(t.opportunity_id)) ||
      (t.lead_id        && leadIds.has(t.lead_id)),
    ).length;
    const valMin = agOpps.reduce((s: number, o: any) => s + (o.value_min ?? o.value ?? 0), 0);
    const valMax = agOpps.reduce((s: number, o: any) => s + (o.value_max ?? o.value_min ?? o.value ?? 0), 0);
    const valStr = valMin > 0 ? ` value=${fmtMoney(valMin, valMax > valMin ? valMax : null)}` : '';
    return `  • Agent: "${a.full_name}" deals=${agOpps.length} leads=${agLeads.length} contacts=${agContacts.length}${valStr}${agOverdue > 0 ? ` overdue_tasks=${agOverdue}` : ''}`;
  });

  // At-risk / stale deals
  const riskLines = opps.slice(0, 20)
    .map((o: any) => {
      const stale = daysSince(o.stage_updated_at ?? o.updated_at);
      const close = daysUntil(o.expected_close_date);
      const val   = fmtMoney(o.value_min ?? o.value ?? 0, o.value_max);
      const flags: string[] = [];
      if (stale > 7)                     flags.push(`stale=${stale}d`);
      if (close >= 0 && close <= 14)     flags.push(`close_in=${close}d`);
      if (o.probability < 40 && close <= 21) flags.push(`prob=${o.probability}%`);
      if (flags.length === 0) return null;
      return `  • Deal: "${o.title}" stage=${o.stage} value=${val} ${flags.join(' ')}`;
    })
    .filter(Boolean);

  const contextBlock = [
    summaryLine,
    agentLines.length > 0 ? `\nAgent workload:\n${agentLines.join('\n')}` : '',
    riskLines.length  > 0 ? `\nDeals needing attention:\n${riskLines.join('\n')}` : '',
    overdueTasks.length > 0
      ? `\nSample overdue tasks:\n${overdueTasks.slice(0, 5).map((t: any) => {
          const over = Math.floor((Date.now() - new Date(t.due_at).getTime()) / 86_400_000);
          return `  • OVERDUE: "${t.title}" (${over}d, priority=${t.priority})`;
        }).join('\n')}`
      : '',
  ].filter(Boolean).join('\n');

  // ── Call OpenAI ─────────────────────────────────────────────────────────────
  const systemPrompt = `You are a concise real-estate brokerage analyst. You analyse a broker's live brokerage data and return a JSON object with exactly these four keys:

"broker_briefing"     — array of 3–5 short sentences summarising the brokerage's current state. Include pipeline value, agent workload, and any standout risks. Use real numbers from the data.
"agent_attention"     — array of 0–3 objects: { agent, reason, severity }. Only agents that genuinely need the broker's attention (no pipeline, high overdue tasks, stale workload). severity is "high" or "normal".
"deal_risks"          — array of 0–3 objects: { name, reason, value, severity }. Only truly at-risk deals (stale > 7 days, close < 14 days with low probability). value is a string (e.g. "$450k"). severity is "high" or "normal".
"recommended_actions" — array of 3–5 short, specific action strings. Each must name a real agent, deal, or metric from the data. No generic advice.

Rules:
- Use the exact names from the data. Never invent names or values.
- Keep every string under 120 characters.
- Do not explain yourself. Return only the JSON object.
- If a section is empty, return an empty array.
- Do not include markdown fences.`;

  const userPrompt = `Here is my brokerage data:\n\n${contextBlock}\n\nReturn the JSON summary.`;

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
        max_tokens:      700,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userPrompt   },
        ],
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!aiRes.ok) {
      console.warn(`[broker-summary] OpenAI error ${aiRes.status}`);
      return NextResponse.json({ error: 'unavailable' });
    }

    const aiJson = await aiRes.json();
    const raw    = aiJson?.choices?.[0]?.message?.content ?? '';

    let parsed: BrokerSummary;
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.warn('[broker-summary] JSON parse failed:', raw.slice(0, 200));
      return NextResponse.json({ error: 'unavailable' });
    }

    // Validate + clamp to prevent unexpected client rendering.
    const summary: BrokerSummary = {
      broker_briefing: Array.isArray(parsed.broker_briefing)
        ? parsed.broker_briefing.slice(0, 5).map(String)
        : [],
      agent_attention: Array.isArray(parsed.agent_attention)
        ? parsed.agent_attention.slice(0, 3).filter(
            (a: any) => a && typeof a.agent === 'string',
          )
        : [],
      deal_risks: Array.isArray(parsed.deal_risks)
        ? parsed.deal_risks.slice(0, 3).filter(
            (d: any) => d && typeof d.name === 'string',
          )
        : [],
      recommended_actions: Array.isArray(parsed.recommended_actions)
        ? parsed.recommended_actions.slice(0, 5).map(String)
        : [],
    };

    return NextResponse.json(summary);
  } catch (err: any) {
    console.warn('[broker-summary] AI call failed:', err?.message ?? err);
    return NextResponse.json({ error: 'unavailable' });
  }
}
