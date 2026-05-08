/**
 * POST /api/cron/sms/pipeline-reminders
 *
 * Sends internal SMS reminders to assigned agents when pipeline deals need attention.
 *
 * Three triggers — each produces at most one SMS per agent per dedup window:
 *
 *   1. STAGE CHANGE   — opportunity moved to a critical stage within the last
 *                       PIPELINE_REMINDER_WINDOW_MINUTES minutes (default 60).
 *                       Dedup: one per (opportunity, new_stage) per calendar day.
 *                       Critical stages: offer_prepared, under_contract, closing_scheduled,
 *                                        active_listing, under_contract_seller, closing_seller
 *
 *   2. STAGNANT       — opportunity has had no stage movement in
 *                       PIPELINE_STAGNANT_DAYS days (default 7).
 *                       Dedup: one per opportunity per ISO week.
 *
 *   3. OVERDUE TASK   — incomplete task linked to an opportunity is past due_at.
 *                       Dedup: one per task per calendar day.
 *
 * Agents only receive reminders for their own assigned opportunities.
 * All messages are internal — no STOP language required for agent-only texts.
 * Still respects sms_opt_out and quiet hours.
 *
 * Security: requires Authorization: Bearer {CRON_SECRET} header.
 * Feature flag: ENABLE_PIPELINE_SMS_REMINDERS=true
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { sendAutomatedSms } from '@/lib/sms/automation';

// ── Auth ──────────────────────────────────────────────────────────────────────

function verifyCronSecret(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return (req.headers.get('authorization') ?? '') === `Bearer ${secret}`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const CRITICAL_STAGES = new Set([
  'offer_prepared',
  'under_contract',
  'closing_scheduled',
  'active_listing',
  'under_contract_seller',
  'closing_seller',
]);

const TERMINAL_STAGES = new Set(['closed', 'lost', 'post_close_followup']);

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

// ISO week number — used for stagnant dedup (one reminder per week per deal)
function isoWeekKey(date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function fmtMoney(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000)     return `$${Math.round(v / 1_000)}k`;
  return `$${v}`;
}

// Resolve agent phone and user_id from brokerage_members.id
async function resolveAgentContact(memberId: string): Promise<{
  phone: string | null;
  userId: string | null;
}> {
  const { data: member } = await supabaseAdmin
    .from('brokerage_members')
    .select('user_id')
    .eq('id', memberId)
    .maybeSingle();
  if (!member?.user_id) return { phone: null, userId: null };

  const { data: user } = await supabaseAdmin
    .from('app_users')
    .select('phone')
    .eq('id', member.user_id)
    .maybeSingle();

  return {
    phone:  user?.phone  ?? null,
    userId: member.user_id as string,
  };
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (process.env.ENABLE_PIPELINE_SMS_REMINDERS !== 'true') {
    return NextResponse.json({ ok: true, skipped: 'feature_disabled' });
  }

  const now              = new Date();
  const todayKey         = todayUtc();
  const weekKey          = isoWeekKey(now);
  const windowMinutes    = parseInt(process.env.PIPELINE_REMINDER_WINDOW_MINUTES ?? '60', 10);
  const stagnantDays     = parseInt(process.env.PIPELINE_STAGNANT_DAYS ?? '7', 10);
  const windowCutoff     = new Date(now.getTime() - windowMinutes * 60_000).toISOString();
  const stagnantCutoff   = new Date(now.getTime() - stagnantDays * 86_400_000).toISOString();

  const stats = { sent: 0, skipped: 0, errors: 0 };

  // ── Trigger 1: Stage changes to critical stages ────────────────────────────
  {
    const { data: opps } = await supabaseAdmin
      .from('opportunities')
      .select('id, brokerage_id, title, stage, value, next_step, assigned_member_id, stage_updated_at')
      .gte('stage_updated_at', windowCutoff)
      .not('assigned_member_id', 'is', null);

    for (const opp of opps ?? []) {
      if (!CRITICAL_STAGES.has(opp.stage)) continue;
      try {
        const { phone, userId } = await resolveAgentContact(opp.assigned_member_id);

        const stageLabel  = opp.stage.replace(/_/g, ' ');
        const nextStep    = opp.next_step ? ` Next: ${opp.next_step}.` : '';
        const body        = `Pipeline update: "${opp.title}" moved to ${stageLabel} (${fmtMoney(opp.value)}).${nextStep} Open Hoard to review.`;

        const result = await sendAutomatedSms({
          brokerageId:      opp.brokerage_id,
          toPhone:          phone,
          body,
          automationType:   'pipeline_stage',
          checkAgentUserId: userId ?? undefined,
          dedup: {
            reminderType: 'pipeline_stage',
            recipientId:  opp.assigned_member_id,
            windowKey:    `${opp.stage}_${todayKey}`,
            referenceId:  opp.id,
          },
        });

        if (result.sent) stats.sent++;
        else stats.skipped++;
      } catch (err) {
        console.error(`[cron/pipeline-reminders] stage trigger opp=${opp.id}:`, err);
        stats.errors++;
      }
    }
  }

  // ── Trigger 2: Stagnant opportunities ─────────────────────────────────────
  {
    const { data: opps } = await supabaseAdmin
      .from('opportunities')
      .select('id, brokerage_id, title, stage, value, next_step, assigned_member_id, stage_updated_at')
      .lt('stage_updated_at', stagnantCutoff)
      .not('assigned_member_id', 'is', null)
      .not('stage', 'in', `(${Array.from(TERMINAL_STAGES).join(',')})`);

    for (const opp of opps ?? []) {
      try {
        const daysSince = Math.floor(
          (now.getTime() - new Date(opp.stage_updated_at).getTime()) / 86_400_000,
        );

        const { phone, userId } = await resolveAgentContact(opp.assigned_member_id);

        const nextStep = opp.next_step ? ` Next step: ${opp.next_step}.` : ' No next step set.';
        const body = `Deal needs attention: "${opp.title}" — ${fmtMoney(opp.value)}. No activity in ${daysSince} days.${nextStep}`;

        const result = await sendAutomatedSms({
          brokerageId:      opp.brokerage_id,
          toPhone:          phone,
          body,
          automationType:   'pipeline_stagnant',
          checkAgentUserId: userId ?? undefined,
          dedup: {
            reminderType: 'pipeline_stagnant',
            recipientId:  opp.assigned_member_id,
            windowKey:    weekKey,
            referenceId:  opp.id,
          },
        });

        if (result.sent) stats.sent++;
        else stats.skipped++;
      } catch (err) {
        console.error(`[cron/pipeline-reminders] stagnant trigger opp=${opp.id}:`, err);
        stats.errors++;
      }
    }
  }

  // ── Trigger 3: Overdue tasks linked to opportunities ──────────────────────
  {
    const { data: tasks } = await supabaseAdmin
      .from('tasks')
      .select('id, brokerage_id, title, due_at, opportunity_id, opportunities!opportunity_id(title, assigned_member_id, value)')
      .eq('completed', false)
      .lt('due_at', now.toISOString())
      .not('opportunity_id', 'is', null);

    for (const task of tasks ?? []) {
      try {
        const opp  = (task as any).opportunities;
        if (!opp?.assigned_member_id) continue;

        const { phone, userId } = await resolveAgentContact(opp.assigned_member_id);

        const daysOver = Math.ceil(
          (now.getTime() - new Date(task.due_at).getTime()) / 86_400_000,
        );
        const daysLabel = daysOver === 1 ? '1 day' : `${daysOver} days`;
        const body = `Overdue task on "${opp.title}": "${task.title}" was due ${daysLabel} ago. Log in to Hoard to follow up.`;

        const result = await sendAutomatedSms({
          brokerageId:      task.brokerage_id,
          toPhone:          phone,
          body,
          automationType:   'pipeline_overdue_task',
          checkAgentUserId: userId ?? undefined,
          dedup: {
            reminderType: 'pipeline_overdue_task',
            recipientId:  opp.assigned_member_id,
            windowKey:    todayKey,
            referenceId:  task.id,
          },
        });

        if (result.sent) stats.sent++;
        else stats.skipped++;
      } catch (err) {
        console.error(`[cron/pipeline-reminders] overdue task=${task.id}:`, err);
        stats.errors++;
      }
    }
  }

  console.log(`[cron/pipeline-reminders] done — sent=${stats.sent} skipped=${stats.skipped} errors=${stats.errors} date=${todayKey}`);
  return NextResponse.json({ ok: true, ...stats });
}
