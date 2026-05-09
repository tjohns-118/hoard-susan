/**
 * POST /api/cron/sms/daily-focus
 *
 * Sends a daily AI-drafted (or rules-based fallback) focus SMS to agents and brokers.
 *
 * Recipients:
 *   Agents  — receive a personal focus text based on their assigned pipeline.
 *             AI-generated if OPENAI_API_KEY is set; rules-based fallback otherwise.
 *   Brokers — receive a brokerage-wide summary (always rules-based in V1).
 *
 * Timing:
 *   Only sends within the configured quiet hours window (default 08:00–20:00 UTC).
 *   DAILY_AI_SMS_HOUR env var is informational — the cron schedule controls actual timing.
 *   This endpoint is designed to be called once per weekday by a scheduler.
 *
 * Dedup: one message per member per calendar day (UTC). Will not re-send if the
 *        cron is accidentally triggered twice in the same day.
 *
 * Message length: trimmed to 320 chars.
 *
 * Security: requires Authorization: Bearer {CRON_SECRET} header.
 *
 * Scheduling: Vercel Hobby does not support cron jobs. To run on a schedule,
 *   use Vercel Pro (add crons to vercel.json) or an external scheduler
 *   (GitHub Actions, Render cron, uptime service, etc.) that calls this
 *   endpoint with the Authorization header weekdays at 14:00 UTC.
 *
 * Feature flag: ENABLE_DAILY_AI_SMS=true
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { sendAutomatedSms } from '@/lib/sms/automation';
import { callOpenAI, SYSTEM_PROMPTS } from '@/lib/ai/hoardIdentity';

export const dynamic = 'force-dynamic';

// ── Auth ──────────────────────────────────────────────────────────────────────

function verifyCronSecret(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return (req.headers.get('authorization') ?? '') === `Bearer ${secret}`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const TERMINAL_STAGES = new Set(['closed', 'lost', 'post_close_followup']);

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function fmtMoney(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `$${Math.round(v / 1_000)}k`;
  return `$${v}`;
}

function trimTo(text: string, max = 320): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + '…';
}

function daysSince(iso: string | null | undefined): number {
  if (!iso) return 999;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

// ── Rules-based agent focus (fallback when AI is unavailable) ─────────────────

function rulesFocusAgent(opts: {
  activeOpps:   number;
  overdueCount: number;
  hotLeadCount: number;
  topOppTitle?: string;
}): string {
  const parts: string[] = [];
  if (opts.overdueCount > 0)
    parts.push(`${opts.overdueCount} overdue task${opts.overdueCount > 1 ? 's' : ''}`);
  if (opts.activeOpps > 0)
    parts.push(`${opts.activeOpps} active deal${opts.activeOpps > 1 ? 's' : ''}`);
  if (opts.hotLeadCount > 0)
    parts.push(`${opts.hotLeadCount} hot lead${opts.hotLeadCount > 1 ? 's' : ''}`);

  const summary = parts.length > 0 ? parts.join(', ') : 'no active items';
  const lead    = opts.topOppTitle ? ` Top: ${opts.topOppTitle}.` : '';
  return trimTo(`Hoard focus: ${summary}.${lead} Open Hoard for details.`);
}

// ── AI-based agent focus ──────────────────────────────────────────────────────

async function aiFocusAgent(opts: {
  memberId:   string;
  brokerageId: string;
  today:      string;
}): Promise<string | null> {
  if (!process.env.OPENAI_API_KEY) return null;

  const now = opts.today;

  const [oppsRes, leadsRes, tasksRes] = await Promise.all([
    supabaseAdmin
      .from('opportunities')
      .select('id, title, stage, value, probability, expected_close_date, updated_at, stage_updated_at')
      .eq('brokerage_id', opts.brokerageId)
      .eq('assigned_member_id', opts.memberId)
      .not('stage', 'in', `(${Array.from(TERMINAL_STAGES).join(',')})`)
      .limit(30),

    supabaseAdmin
      .from('contacts')
      .select('id, full_name, tags, updated_at')
      .eq('brokerage_id', opts.brokerageId)
      .eq('assigned_to_member_id', opts.memberId)
      .limit(30),

    supabaseAdmin
      .from('tasks')
      .select('id, title, priority, due_at, completed, opportunity_id')
      .eq('brokerage_id', opts.brokerageId)
      .eq('completed', false)
      .limit(40),
  ]);

  const opps  = oppsRes.data   ?? [];
  const leads = leadsRes.data  ?? [];
  const tasks = (tasksRes.data ?? []).filter(
    (t: any) => opps.some((o: any) => o.id === t.opportunity_id),
  );

  const overdue = tasks.filter((t: any) => t.due_at && t.due_at.slice(0, 10) < now);

  if (opps.length === 0 && leads.length === 0 && tasks.length === 0) return null;

  const oppLines  = opps.slice(0, 10).map((o: any) =>
    `  • "${o.title}" stage=${o.stage} val=${fmtMoney(o.value ?? 0)} stale=${daysSince(o.stage_updated_at)}d`,
  );
  const leadLines = leads
    .filter((l: any) => (l.tags ?? []).includes('hot'))
    .slice(0, 5)
    .map((l: any) => `  • Hot lead: "${l.full_name}" last_touch=${daysSince(l.updated_at)}d_ago`);
  const taskLines = overdue.slice(0, 5).map((t: any) =>
    `  • OVERDUE: "${t.title}"`,
  );

  const context = [
    `Today: ${now}`,
    oppLines.length  > 0 ? `Active deals:\n${oppLines.join('\n')}` : '',
    leadLines.length > 0 ? `Hot leads:\n${leadLines.join('\n')}` : '',
    taskLines.length > 0 ? `Overdue tasks:\n${taskLines.join('\n')}` : '',
  ].filter(Boolean).join('\n\n');

  try {
    const raw = await callOpenAI({
      systemPrompt: SYSTEM_PROMPTS.agentSummary,
      userPrompt:   `Here is my pipeline data:\n\n${context}\n\nReturn the JSON summary.`,
      json:         true,
      maxTokens:    400,
    });

    if (!raw) return null;

    const parsed = JSON.parse(raw);
    const focus: string[] = Array.isArray(parsed.today_focus) ? parsed.today_focus : [];
    if (focus.length === 0) return null;

    const items = focus.slice(0, 3).map((f: string, i: number) => `${i + 1}) ${f}`);
    return trimTo(`Today's Hoard focus: ${items.join(' ')}`);
  } catch {
    return null;
  }
}

// ── Rules-based broker summary ────────────────────────────────────────────────

async function rulesBrokerSummary(brokerageId: string): Promise<string> {
  const now = new Date().toISOString();

  const [oppsRes, tasksRes, membersRes] = await Promise.all([
    supabaseAdmin
      .from('opportunities')
      .select('id, value, stage_updated_at')
      .eq('brokerage_id', brokerageId)
      .not('stage', 'in', `(${Array.from(TERMINAL_STAGES).join(',')})`),

    supabaseAdmin
      .from('tasks')
      .select('id, due_at, completed')
      .eq('brokerage_id', brokerageId)
      .eq('completed', false)
      .lt('due_at', now),

    supabaseAdmin
      .from('brokerage_members')
      .select('id')
      .eq('brokerage_id', brokerageId)
      .eq('is_active', true)
      .eq('role', 'agent'),
  ]);

  const opps           = oppsRes.data    ?? [];
  const overdueTasks   = tasksRes.data   ?? [];
  const agentCount     = membersRes.data?.length ?? 0;
  const totalPipeline  = opps.reduce((s: number, o: any) => s + (o.value ?? 0), 0);

  return trimTo(
    `Hoard: ${fmtMoney(totalPipeline)} pipeline across ${opps.length} deals, ` +
    `${overdueTasks.length} overdue task${overdueTasks.length !== 1 ? 's' : ''}, ` +
    `${agentCount} active agent${agentCount !== 1 ? 's' : ''}. Open Hoard to review.`,
  );
}

// ── Main handler ──────────────────────────────────────────────────────────────

// Vercel Cron sends GET. POST is kept for manual curl testing with CRON_SECRET.
export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (process.env.ENABLE_DAILY_AI_SMS !== 'true') {
    return NextResponse.json({ ok: true, skipped: 'feature_disabled' });
  }

  const today  = todayUtc();
  const stats  = { sent: 0, skipped: 0, errors: 0 };

  // Fetch all active members with phones across all brokerages
  const { data: members, error: membersErr } = await supabaseAdmin
    .from('brokerage_members')
    .select('id, role, brokerage_id, user_id')
    .eq('is_active', true)
    .in('role', ['agent', 'broker']);

  if (membersErr) {
    console.error('[cron/daily-focus] members query failed:', membersErr.message);
    return NextResponse.json({ error: 'db_error' }, { status: 500 });
  }

  for (const member of members ?? []) {
    try {
      // Resolve app_user phone
      const { data: user } = await supabaseAdmin
        .from('app_users')
        .select('phone')
        .eq('id', member.user_id)
        .maybeSingle();

      const phone = user?.phone ?? null;

      // Build focus text
      const reminderType = member.role === 'broker' ? 'daily_focus_broker' : 'daily_focus_agent';
      const automationType = (member.role === 'broker' ? 'daily_focus_broker' : 'daily_focus_agent') as any;

      let body: string;
      if (member.role === 'broker') {
        body = await rulesBrokerSummary(member.brokerage_id);
      } else {
        const aiText = await aiFocusAgent({
          memberId:    member.id,
          brokerageId: member.brokerage_id,
          today,
        });

        if (aiText) {
          body = aiText;
        } else {
          // Rules-based fallback
          const [oppsRes, leadsRes, tasksRes] = await Promise.all([
            supabaseAdmin
              .from('opportunities')
              .select('id, title, value, stage_updated_at')
              .eq('brokerage_id', member.brokerage_id)
              .eq('assigned_member_id', member.id)
              .not('stage', 'in', `(${Array.from(TERMINAL_STAGES).join(',')})`)
              .order('value', { ascending: false })
              .limit(20),

            supabaseAdmin
              .from('contacts')
              .select('id, tags')
              .eq('brokerage_id', member.brokerage_id)
              .eq('assigned_to_member_id', member.id)
              .limit(30),

            supabaseAdmin
              .from('tasks')
              .select('id, opportunity_id, due_at')
              .eq('brokerage_id', member.brokerage_id)
              .eq('completed', false)
              .lt('due_at', new Date().toISOString())
              .limit(20),
          ]);

          const opps      = oppsRes.data   ?? [];
          const contacts  = leadsRes.data  ?? [];
          const overTasks = tasksRes.data  ?? [];
          const oppIds    = new Set(opps.map((o: any) => o.id));
          const myOverdue = overTasks.filter((t: any) => t.opportunity_id && oppIds.has(t.opportunity_id));
          const hotLeads  = contacts.filter((c: any) => (c.tags ?? []).includes('hot'));
          const topOpp    = opps[0];

          body = rulesFocusAgent({
            activeOpps:   opps.length,
            overdueCount: myOverdue.length,
            hotLeadCount: hotLeads.length,
            topOppTitle:  topOpp?.title,
          });
        }
      }

      const result = await sendAutomatedSms({
        brokerageId:      member.brokerage_id,
        toPhone:          phone,
        body,
        automationType,
        checkAgentUserId: member.user_id,
        dedup: {
          reminderType,
          recipientId: member.id,
          windowKey:   today,
        },
      });

      if (result.sent) stats.sent++;
      else stats.skipped++;
    } catch (err) {
      console.error(`[cron/daily-focus] member=${member.id} error:`, err);
      stats.errors++;
    }
  }

  console.log(`[cron/daily-focus] done — sent=${stats.sent} skipped=${stats.skipped} errors=${stats.errors} date=${today}`);
  return NextResponse.json({ ok: true, sent: stats.sent, skipped: stats.skipped, failed: stats.errors });
}

export const POST = GET;
