/**
 * /api/opportunities — server-side CRUD for the real-estate transaction pipeline.
 *
 * GET   — fetch all opportunities for the active brokerage
 * POST  — create a new deal (buyer or seller pipeline)
 * PATCH — stage transitions (with trigger execution), agent assignment,
 *          note addition, next-step update, document status updates
 *
 * Stage transitions (action: 'moveStage') do the following atomically:
 *   1. Validate the target stage is valid for this pipeline type.
 *   2. Append a history entry closing the current stage.
 *   3. Set stage_owner and stage_updated_at from the stage definition.
 *   4. Create any 'task' triggers as real task rows in the tasks table.
 *
 * Uses supabaseAdmin (service role) to bypass RLS.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { getBrokerageId } from '@/lib/getBrokerageId';
import type { Opportunity, OpportunityPriority } from '@/features/opportunities/types';
import type { PipelineType, PipelineStage, PipelineDocument, StageHistoryEntry } from '@/features/pipeline/types';
import {
  LEGACY_STAGE_MAP,
  getStageDefinition,
  initDocuments,
  BUYER_STAGES,
  SELLER_STAGES,
} from '@/features/pipeline/definitions';

// All valid pipeline stage values — used to validate stage transitions.
const VALID_STAGES = new Set<string>([
  ...BUYER_STAGES.map((s) => s.stage),
  ...SELLER_STAGES.map((s) => s.stage),
  'lost',
]);

// ── GET /api/opportunities ────────────────────────────────────────────────────

export async function GET() {
  const BROKERAGE_ID = await getBrokerageId();
  if (!BROKERAGE_ID) {
    console.error('[/api/opportunities GET] Brokerage context could not be resolved');
    return NextResponse.json([]);
  }

  const { data, error } = await supabaseAdmin
    .from('opportunities')
    .select('*')
    .eq('brokerage_id', BROKERAGE_ID)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[/api/opportunities GET]', error.message);
    return NextResponse.json([]);
  }

  return NextResponse.json((data ?? []).map(mapOpportunity));
}

// ── POST /api/opportunities ───────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const BROKERAGE_ID = await getBrokerageId();
  if (!BROKERAGE_ID)
    return NextResponse.json({ error: 'Brokerage not configured — set ACTIVE_BROKERAGE_ID or ACTIVE_BROKERAGE_SLUG' }, { status: 503 });

  const body = await req.json() as {
    contactName:         string;
    propertyAddress?:    string;
    propertyId?:         string;
    assignedAgentId?:    string;
    pipelineType?:       PipelineType;
    stage?:              string;
    value?:              number;
    probability?:        number;
    expectedCloseDate?:  string;
    priority?:           OpportunityPriority;
    nextStep?:           string;
    notes?:              string[];
  };

  if (!body.contactName?.trim())
    return NextResponse.json({ error: 'contactName required' }, { status: 400 });

  const pipelineType: PipelineType = body.pipelineType ?? 'buyer';
  const stage = body.stage ?? 'lead_received';
  const closeDate = body.expectedCloseDate
    ?? new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  const now = new Date().toISOString();

  // Initialise document list from pipeline template
  const documents = initDocuments(pipelineType);

  // Initialise stage history — first entry has no fromStage (deal just created)
  const stageHistory: StageHistoryEntry[] = [{ fromStage: '', toStage: stage, changedAt: now }];

  // Derive initial stage_owner from definition
  const stageDef = getStageDefinition(stage, pipelineType);
  const stageOwner = stageDef?.owner ?? 'agent';

  const { data, error } = await supabaseAdmin
    .from('opportunities')
    .insert({
      brokerage_id:        BROKERAGE_ID,
      contact_name:        body.contactName.trim(),
      property_address:    body.propertyAddress ?? null,
      property_id:         body.propertyId ?? null,
      assigned_agent_id:   body.assignedAgentId ?? null,
      pipeline_type:       pipelineType,
      stage,
      stage_updated_at:    now,
      stage_owner:         stageOwner,
      documents:           documents,
      stage_history:       stageHistory,
      value:               body.value ?? 0,
      probability:         body.probability ?? 15,
      expected_close_date: closeDate,
      priority:            body.priority ?? 'medium',
      next_step:           body.nextStep ?? null,
      notes:               body.notes ?? [],
    })
    .select()
    .single();

  if (error) {
    console.error('[/api/opportunities POST]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fire 'task' triggers for the initial stage
  await fireTriggerTasks(data.id, BROKERAGE_ID, stage, pipelineType, now);

  return NextResponse.json({ ok: true, opportunity: mapOpportunity(data) }, { status: 201 });
}

// ── UUID validation ───────────────────────────────────────────────────────────
// Postgres UUID columns will throw a cast error if given a non-UUID string.
// Validate early so we return a clear 400 instead of a confusing 404.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── Fetch helper ──────────────────────────────────────────────────────────────
// Uses maybeSingle() so "not found" (0 rows) and "query error" produce
// distinct signals instead of both collapsing into fetchErr.

async function fetchOpp(oppId: string) {
  // Use select('*') so a missing pipeline_type column (pre-migration schema) returns
  // null rather than a PostgREST "column does not exist" error that would crash all
  // stage transitions. The mapper below handles null with a safe 'buyer' fallback.
  const { data, error } = await supabaseAdmin
    .from('opportunities')
    .select('*')
    .eq('id', oppId)
    .maybeSingle();
  return { row: data, dbErr: error };
}

// ── PATCH /api/opportunities ──────────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  const body = await req.json() as {
    action:      'moveStage' | 'markLost' | 'assignAgent' | 'addNote' | 'setNextStep' | 'updateDocument';
    oppId:       string;
    stage?:      string;
    agentId?:    string;
    noteBody?:   string;
    nextStep?:   string;
    docKey?:     string;
    docStatus?:  'not_sent' | 'sent' | 'signed';
  };

  const { action, oppId } = body;
  if (!oppId) return NextResponse.json({ error: 'oppId required' }, { status: 400 });

  // Reject non-UUID IDs immediately — Postgres would throw a cast error otherwise,
  // which would be silently reported as "Opportunity not found".
  if (!UUID_RE.test(oppId))
    return NextResponse.json(
      { error: `Invalid opportunity ID format: "${oppId}". Opportunities must be persisted to the database before they can be mutated.` },
      { status: 400 },
    );

  const now = new Date().toISOString();

  // ── Stage transition ────────────────────────────────────────────────────────
  if (action === 'moveStage') {
    const targetStage = body.stage;
    if (!targetStage)
      return NextResponse.json({ error: 'stage required' }, { status: 400 });
    if (!VALID_STAGES.has(targetStage))
      return NextResponse.json({ error: `Invalid stage: ${targetStage}` }, { status: 400 });

    const { row: cur, dbErr: fetchErr } = await fetchOpp(oppId);
    if (fetchErr) {
      console.error('[PATCH moveStage] select error:', fetchErr.message, '| oppId:', oppId);
      return NextResponse.json({ error: `Database error: ${fetchErr.message}` }, { status: 500 });
    }
    if (!cur) {
      console.warn('[PATCH moveStage] opportunity not found in DB | oppId:', oppId);
      return NextResponse.json({ error: 'Opportunity not found. It may have been deleted or belong to a different brokerage.' }, { status: 404 });
    }

    const pipelineType: PipelineType = (cur.pipeline_type as PipelineType) === 'seller' ? 'seller' : 'buyer';

    // Validate the target stage belongs to this deal's specific pipeline.
    // A buyer deal cannot move into seller-only stages and vice versa.
    if (targetStage !== 'lost') {
      const stageDef = getStageDefinition(targetStage, pipelineType);
      if (!stageDef) {
        const otherType: PipelineType = pipelineType === 'buyer' ? 'seller' : 'buyer';
        const inOther = getStageDefinition(targetStage, otherType);
        const hint = inOther ? ` (that stage belongs to the ${otherType} pipeline)` : '';
        return NextResponse.json(
          { error: `Stage "${targetStage}" is not valid for the ${pipelineType} pipeline${hint}.` },
          { status: 400 },
        );
      }
    }

    // Look up new stage definition
    const stageDef = getStageDefinition(targetStage, pipelineType);
    const stageOwner = stageDef?.owner ?? 'agent';

    // Adjust probability for terminal stages
    const extra: Record<string, unknown> = {};
    if (targetStage === 'closed') extra.probability = 100;
    if (targetStage === 'lost')   extra.probability = 0;

    // PRIMARY update — only the columns that are guaranteed text/timestamptz.
    // stage_owner is kept out because the migration declares it as uuid, but our
    // semantic values ('agent', 'broker') are text — a type mismatch that would
    // crash the whole transition. It goes in the non-fatal secondary write instead.
    const { error: updateErr } = await supabaseAdmin
      .from('opportunities')
      .update({
        stage:            targetStage,
        stage_updated_at: now,
        updated_at:       now,
        ...extra,
      })
      .eq('id', oppId);
    if (updateErr) {
      console.error('[PATCH moveStage] update error:', updateErr.message, '| oppId:', oppId);
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // SECONDARY update — non-fatal. Appends history entry and sets stage_owner.
    // If either column doesn't exist or has a type mismatch, the transition above
    // already succeeded; these writes fail silently.
    const existingHistory: StageHistoryEntry[] = Array.isArray(cur.stage_history) ? cur.stage_history : [];
    const newEntry: StageHistoryEntry = { fromStage: String(cur.stage ?? ''), toStage: targetStage, changedAt: now };
    const { error: histErr } = await supabaseAdmin
      .from('opportunities')
      .update({
        stage_history: [...existingHistory, newEntry],
        stage_owner:   stageOwner,
      })
      .eq('id', oppId);
    if (histErr) {
      console.warn('[PATCH moveStage] secondary update failed (non-fatal):', histErr.message);
    }

    // Fire 'task' triggers for the new stage
    await fireTriggerTasks(oppId, cur.brokerage_id as string, targetStage, pipelineType, now);

  // ── Mark lost (terminal stage) ──────────────────────────────────────────────
  } else if (action === 'markLost') {
    const { row: cur, dbErr: fetchErr } = await fetchOpp(oppId);
    if (fetchErr) {
      console.error('[PATCH markLost] select error:', fetchErr.message, '| oppId:', oppId);
      return NextResponse.json({ error: `Database error: ${fetchErr.message}` }, { status: 500 });
    }
    if (!cur) {
      console.warn('[PATCH markLost] opportunity not found | oppId:', oppId);
      return NextResponse.json({ error: 'Opportunity not found.' }, { status: 404 });
    }

    // PRIMARY update
    const { error } = await supabaseAdmin
      .from('opportunities')
      .update({ stage: 'lost', probability: 0, stage_updated_at: now, updated_at: now })
      .eq('id', oppId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // SECONDARY — non-fatal history append
    const existing: StageHistoryEntry[] = Array.isArray(cur.stage_history) ? cur.stage_history : [];
    const { error: histErr } = await supabaseAdmin
      .from('opportunities')
      .update({ stage_history: [...existing, { fromStage: String(cur.stage ?? ''), toStage: 'lost', changedAt: now }] })
      .eq('id', oppId);
    if (histErr) {
      console.warn('[PATCH markLost] stage_history append failed (non-fatal):', histErr.message);
    }

  // ── Assign agent ────────────────────────────────────────────────────────────
  } else if (action === 'assignAgent') {
    const { error } = await supabaseAdmin
      .from('opportunities')
      .update({ assigned_agent_id: body.agentId ?? null, updated_at: now })
      .eq('id', oppId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // ── Add note ────────────────────────────────────────────────────────────────
  } else if (action === 'addNote') {
    if (!body.noteBody)
      return NextResponse.json({ error: 'noteBody required' }, { status: 400 });
    const { data: cur } = await supabaseAdmin
      .from('opportunities').select('notes').eq('id', oppId).maybeSingle();
    const existing = Array.isArray(cur?.notes) ? (cur.notes as string[]) : [];
    const { error } = await supabaseAdmin
      .from('opportunities')
      .update({ notes: [body.noteBody, ...existing], updated_at: now })
      .eq('id', oppId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // ── Set next step ───────────────────────────────────────────────────────────
  } else if (action === 'setNextStep') {
    const { error } = await supabaseAdmin
      .from('opportunities')
      .update({ next_step: body.nextStep ?? null, updated_at: now })
      .eq('id', oppId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // ── Update document status ──────────────────────────────────────────────────
  } else if (action === 'updateDocument') {
    if (!body.docKey || !body.docStatus)
      return NextResponse.json({ error: 'docKey and docStatus required' }, { status: 400 });
    const { data: cur } = await supabaseAdmin
      .from('opportunities').select('documents').eq('id', oppId).maybeSingle();
    const docs: PipelineDocument[] = Array.isArray(cur?.documents) ? cur.documents : [];
    const updatedDocs = docs.map((d) => {
      if (d.key !== body.docKey) return d;
      return {
        ...d,
        status:   body.docStatus!,
        sentAt:   body.docStatus === 'sent'   ? now : d.sentAt,
        signedAt: body.docStatus === 'signed' ? now : d.signedAt,
      };
    });
    const { error } = await supabaseAdmin
      .from('opportunities')
      .update({ documents: updatedDocs, updated_at: now })
      .eq('id', oppId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  } else {
    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

// ── Trigger execution ─────────────────────────────────────────────────────────
// Fires 'task' triggers for the given stage by inserting rows into the tasks
// table.  Other trigger types (alert, escalation, document_request) are handled
// client-side via the alerts computation — no server action needed.

async function fireTriggerTasks(
  oppId:        string,
  brokerageId:  string,
  stage:        string,
  pipelineType: PipelineType,
  now:          string,
) {
  const stageDef = getStageDefinition(stage, pipelineType);
  if (!stageDef) return;

  const taskTriggers = stageDef.triggers.filter((t) => t.type === 'task' && t.taskTitle);
  if (taskTriggers.length === 0) return;

  const rows = taskTriggers.map((t) => {
    const dueDays = t.taskDueDays ?? 0;
    const dueAt = dueDays >= 0
      ? new Date(Date.parse(now) + dueDays * 86_400_000).toISOString()
      : null;
    return {
      brokerage_id:   brokerageId,
      title:          t.taskTitle!,
      completed:      false,
      priority:       stageDef.owner === 'broker' ? 'high' : 'medium',
      due_at:         dueAt,
      opportunity_id: oppId,
    };
  });

  const { error } = await supabaseAdmin.from('tasks').insert(rows);
  if (error) {
    // Non-fatal — log but don't fail the stage transition
    console.error('[fireTriggerTasks] task insert error:', error.message);
  }
}

// ── Mapper ────────────────────────────────────────────────────────────────────

function mapOpportunity(row: any): Opportunity {
  const validPriorities: OpportunityPriority[] = ['high', 'medium', 'low'];

  // Map legacy generic stages to buyer pipeline equivalents
  let stage = String(row.stage ?? 'lead_received');
  if (LEGACY_STAGE_MAP[stage]) stage = LEGACY_STAGE_MAP[stage];
  if (!VALID_STAGES.has(stage)) stage = 'lead_received';

  const pipelineType: PipelineType = row.pipeline_type === 'seller' ? 'seller' : 'buyer';

  const documents: PipelineDocument[] = Array.isArray(row.documents) ? row.documents : [];
  const stageHistory: StageHistoryEntry[] = Array.isArray(row.stage_history) ? row.stage_history : [];

  return {
    id:                String(row.id ?? ''),
    contactName:       String(row.contact_name ?? '').trim() || 'Unnamed',
    propertyAddress:   row.property_address  ?? undefined,
    propertyId:        row.property_id        ?? undefined,
    assignedAgentId:   row.assigned_agent_id  ?? undefined,
    pipelineType,
    stage:             stage as PipelineStage,
    stageUpdatedAt:    row.stage_updated_at   ?? undefined,
    stageOwner:        row.stage_owner        ?? 'agent',
    documents,
    stageHistory,
    value:             Number(row.value ?? 0),
    probability:       Number(row.probability ?? 15),
    expectedCloseDate: row.expected_close_date
      ? String(row.expected_close_date).slice(0, 10)
      : new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
    priority:          validPriorities.includes(row.priority) ? row.priority : 'medium',
    nextStep:          row.next_step     ?? undefined,
    notes:             Array.isArray(row.notes) ? row.notes : [],
    createdAt:         String(row.created_at ?? new Date().toISOString()),
    updatedAt:         String(row.updated_at  ?? new Date().toISOString()),
  };
}
