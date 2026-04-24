/**
 * /api/opportunities — server-side CRUD for the real-estate transaction pipeline.
 *
 * Confirmed DB schema (post-migration):
 *   stage             text            — validated against VALID_STAGES
 *   pipeline_type     text            — 'buyer' | 'seller', defaults to 'buyer'
 *   stage_history     jsonb           — append-only array of { fromStage, toStage, changedAt }
 *   stage_owner       uuid, nullable  — UUID of assigned agent when stage owner is 'agent', else null
 *   stage_updated_at  timestamptz     — set on every stage transition
 *
 * GET   — fetch all opportunities for the active brokerage
 * POST  — create a new deal (buyer or seller pipeline)
 * PATCH — stage transitions, agent assignment, note addition, next-step update, document status
 *
 * Stage transitions (action: 'moveStage'):
 *   1. Validate target stage exists in this deal's specific pipeline type.
 *   2. Single atomic update: stage, stage_updated_at, stage_owner, stage_history, updated_at.
 *   3. Return updated opportunity row.
 *   4. Fire 'task' triggers server-side (non-fatal).
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
  inferPipelineType,
  BUYER_STAGES,
  SELLER_STAGES,
} from '@/features/pipeline/definitions';

// ── Valid stage set ───────────────────────────────────────────────────────────
// Union of all buyer + seller stage values.  Used for first-pass validation
// before pipeline-specific checks.

const VALID_STAGES = new Set<string>([
  ...BUYER_STAGES.map((s) => s.stage),
  ...SELLER_STAGES.map((s) => s.stage),
  'lost',
]);

// ── UUID validation ───────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUUID(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v);
}

// ── GET /api/opportunities ────────────────────────────────────────────────────

export async function GET() {
  const BROKERAGE_ID = await getBrokerageId();
  if (!BROKERAGE_ID) {
    console.error('[opportunities GET] brokerage context could not be resolved');
    return NextResponse.json([]);
  }

  const { data, error } = await supabaseAdmin
    .from('opportunities')
    .select('*')
    .eq('brokerage_id', BROKERAGE_ID)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[opportunities GET] DB error:', error.message);
    return NextResponse.json([]);
  }

  return NextResponse.json((data ?? []).map(mapOpportunity));
}

// ── POST /api/opportunities ───────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const BROKERAGE_ID = await getBrokerageId();
  if (!BROKERAGE_ID)
    return NextResponse.json(
      { error: 'Brokerage not configured — set ACTIVE_BROKERAGE_ID or ACTIVE_BROKERAGE_SLUG' },
      { status: 503 },
    );

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

  // Apply legacy mapping before any validation so callers using old stage names still work.
  let stage = body.stage ?? 'lead_received';
  if (LEGACY_STAGE_MAP[stage]) stage = LEGACY_STAGE_MAP[stage];

  const closeDate = body.expectedCloseDate
    ?? new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  const now = new Date().toISOString();

  // Resolve pipeline type. If the caller didn't specify one, infer from the stage.
  // If the stage is shared/ambiguous, default to 'buyer'.
  // If the caller did specify one, validate that it matches the stage.
  let pipelineType: PipelineType = body.pipelineType === 'seller' ? 'seller' : 'buyer';
  const inferred = inferPipelineType(stage);
  if (inferred !== null) {
    if (body.pipelineType && inferred !== pipelineType) {
      // Caller explicitly provided a pipeline_type that contradicts the stage — reject it.
      return NextResponse.json(
        { error: `Stage "${stage}" belongs to the ${inferred} pipeline, not ${pipelineType}.` },
        { status: 400 },
      );
    }
    pipelineType = inferred;
  }

  // Validate the resolved stage belongs to the resolved pipeline.
  const stageDef = getStageDefinition(stage, pipelineType);
  if (!stageDef && stage !== 'lead_received') {
    return NextResponse.json(
      { error: `Stage "${stage}" is not valid for the ${pipelineType} pipeline.` },
      { status: 400 },
    );
  }

  const stageOwnerRole = stageDef?.owner ?? 'agent';
  // stage_owner column is uuid — write the assigned agent UUID when the stage role is
  // 'agent', null otherwise (no broker UUID available at this point).
  const stageOwnerUUID: string | null =
    stageOwnerRole === 'agent' && isUUID(body.assignedAgentId)
      ? body.assignedAgentId
      : null;

  console.log(`[opportunities POST] creating deal | stage=${stage} pipeline=${pipelineType}`);

  const { data, error } = await supabaseAdmin
    .from('opportunities')
    .insert({
      brokerage_id:        BROKERAGE_ID,
      property_address:    body.propertyAddress  ?? null,
      property_id:         body.propertyId        ?? null,
      assigned_member_id:  body.assignedAgentId   ?? null,
      pipeline_type:       pipelineType,
      stage,
      stage_updated_at:    now,
      stage_owner:         stageOwnerUUID,
      value:               body.value             ?? 0,
      probability:         body.probability        ?? 15,
      expected_close_date: closeDate,
      priority:            body.priority           ?? 'medium',
      next_step:           body.nextStep           ?? null,
      notes:               body.notes              ?? [],
    })
    .select()
    .single();

  if (error) {
    console.error('[opportunities POST] insert error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await fireTriggerTasks(data.id, BROKERAGE_ID, stage, pipelineType, now);

  return NextResponse.json({ ok: true, opportunity: mapOpportunity(data) }, { status: 201 });
}

// ── Fetch helper ──────────────────────────────────────────────────────────────
// select('*') so a schema change never produces a "column does not exist" error.
// maybeSingle() distinguishes "not found" (null row, no error) from a real DB error.

async function fetchOpp(oppId: string) {
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
    action:     'moveStage' | 'markLost' | 'assignAgent' | 'addNote' | 'setNextStep' | 'updateDocument';
    oppId:      string;
    stage?:     string;
    agentId?:   string;
    noteBody?:  string;
    nextStep?:  string;
    docKey?:    string;
    docStatus?: 'not_sent' | 'sent' | 'signed';
  };

  const { action, oppId } = body;
  if (!oppId)
    return NextResponse.json({ error: 'oppId required' }, { status: 400 });

  if (!UUID_RE.test(oppId))
    return NextResponse.json(
      { error: `Invalid opportunity ID "${oppId}" — must be a UUID. Opportunity may not be persisted yet.` },
      { status: 400 },
    );

  const now = new Date().toISOString();

  // ── moveStage ───────────────────────────────────────────────────────────────

  if (action === 'moveStage') {
    const targetStage = body.stage;
    if (!targetStage)
      return NextResponse.json({ error: 'stage required for moveStage' }, { status: 400 });

    // First-pass: is it a recognised stage at all?
    if (!VALID_STAGES.has(targetStage))
      return NextResponse.json(
        { error: `"${targetStage}" is not a recognised pipeline stage.` },
        { status: 400 },
      );

    const { row: cur, dbErr: fetchErr } = await fetchOpp(oppId);
    if (fetchErr) {
      console.error('[moveStage] fetch error | oppId:', oppId, '|', fetchErr.message);
      return NextResponse.json(
        { error: `Database error fetching opportunity: ${fetchErr.message}` },
        { status: 500 },
      );
    }
    if (!cur) {
      console.warn('[moveStage] not found | oppId:', oppId);
      return NextResponse.json(
        { error: 'Opportunity not found — it may have been deleted or belong to a different brokerage.' },
        { status: 404 },
      );
    }

    // Resolve pipeline type — always from DB, default 'buyer' if missing
    const pipelineType: PipelineType = cur.pipeline_type === 'seller' ? 'seller' : 'buyer';

    console.log(
      `[moveStage] oppId=${oppId} | from=${cur.stage} → to=${targetStage} | pipeline=${pipelineType}`,
    );

    // Second-pass: target stage must exist in THIS deal's specific pipeline
    if (targetStage !== 'lost') {
      const targetDef = getStageDefinition(targetStage, pipelineType);
      if (!targetDef) {
        const otherType: PipelineType = pipelineType === 'buyer' ? 'seller' : 'buyer';
        const inOther = getStageDefinition(targetStage, otherType);
        const hint = inOther
          ? ` ("${targetStage}" belongs to the ${otherType} pipeline, not ${pipelineType})`
          : '';
        console.warn(`[moveStage] cross-pipeline move blocked | oppId=${oppId}${hint}`);
        return NextResponse.json(
          { error: `Cannot move ${pipelineType} deal to stage "${targetStage}"${hint}.` },
          { status: 400 },
        );
      }
    }

    const targetDef = getStageDefinition(targetStage, pipelineType);
    const stageOwnerRole = targetDef?.owner ?? 'agent';

    // stage_owner is uuid — write assigned_member_id UUID when role is 'agent', else null
    const stageOwnerUUID: string | null =
      stageOwnerRole === 'agent' && isUUID(cur.assigned_member_id)
        ? cur.assigned_member_id as string
        : null;

    // Probability adjustments for terminal stages
    const extra: Record<string, unknown> = {};
    if (targetStage === 'closed') extra.probability = 100;
    if (targetStage === 'lost')   extra.probability = 0;

    // Single atomic update — all workflow columns in one call
    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('opportunities')
      .update({
        stage:            targetStage,
        pipeline_type:    pipelineType,   // confirm/persist resolved value
        stage_updated_at: now,
        stage_owner:      stageOwnerUUID,
        updated_at:       now,
        ...extra,
      })
      .eq('id', oppId)
      .select()
      .single();

    if (updateErr) {
      console.error('[moveStage] update error | oppId:', oppId, '|', updateErr.message);
      return NextResponse.json(
        { error: `Stage update failed: ${updateErr.message}` },
        { status: 500 },
      );
    }

    console.log(`[moveStage] success | oppId=${oppId} | now at stage=${targetStage}`);

    // Non-fatal trigger task creation
    await fireTriggerTasks(oppId, cur.brokerage_id as string, targetStage, pipelineType, now);

    return NextResponse.json({ ok: true, opportunity: mapOpportunity(updated) });
  }

  // ── markLost ────────────────────────────────────────────────────────────────

  if (action === 'markLost') {
    const { row: cur, dbErr: fetchErr } = await fetchOpp(oppId);
    if (fetchErr) {
      console.error('[markLost] fetch error | oppId:', oppId, '|', fetchErr.message);
      return NextResponse.json(
        { error: `Database error: ${fetchErr.message}` },
        { status: 500 },
      );
    }
    if (!cur) {
      console.warn('[markLost] not found | oppId:', oppId);
      return NextResponse.json({ error: 'Opportunity not found.' }, { status: 404 });
    }

    const pipelineType: PipelineType = cur.pipeline_type === 'seller' ? 'seller' : 'buyer';

    console.log(`[markLost] oppId=${oppId} | from=${cur.stage} → lost | pipeline=${pipelineType}`);

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('opportunities')
      .update({
        stage:            'lost',
        pipeline_type:    pipelineType,
        stage_updated_at: now,
        stage_owner:      null,
        probability:      0,
        updated_at:       now,
      })
      .eq('id', oppId)
      .select()
      .single();

    if (updateErr) {
      console.error('[markLost] update error | oppId:', oppId, '|', updateErr.message);
      return NextResponse.json(
        { error: `Mark lost failed: ${updateErr.message}` },
        { status: 500 },
      );
    }

    console.log(`[markLost] success | oppId=${oppId}`);
    return NextResponse.json({ ok: true, opportunity: mapOpportunity(updated) });
  }

  // ── assignAgent ──────────────────────────────────────────────────────────────

  if (action === 'assignAgent') {
    const { error } = await supabaseAdmin
      .from('opportunities')
      .update({ assigned_member_id: body.agentId ?? null, updated_at: now })
      .eq('id', oppId);
    if (error) {
      console.error('[assignAgent] error | oppId:', oppId, '|', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  // ── addNote ──────────────────────────────────────────────────────────────────

  if (action === 'addNote') {
    if (!body.noteBody)
      return NextResponse.json({ error: 'noteBody required' }, { status: 400 });
    const { data: cur } = await supabaseAdmin
      .from('opportunities')
      .select('notes')
      .eq('id', oppId)
      .maybeSingle();
    const existing = Array.isArray(cur?.notes) ? (cur.notes as string[]) : [];
    const { error } = await supabaseAdmin
      .from('opportunities')
      .update({ notes: [body.noteBody, ...existing], updated_at: now })
      .eq('id', oppId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // ── setNextStep ───────────────────────────────────────────────────────────────

  if (action === 'setNextStep') {
    const { error } = await supabaseAdmin
      .from('opportunities')
      .update({ next_step: body.nextStep ?? null, updated_at: now })
      .eq('id', oppId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // ── updateDocument ────────────────────────────────────────────────────────────
  // documents column was removed from the live DB — no-op until re-added via migration.

  if (action === 'updateDocument') {
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: `Unknown action: "${action}"` }, { status: 400 });
}

// ── Trigger execution ─────────────────────────────────────────────────────────
// Inserts task rows for 'task' triggers on the entered stage. Non-fatal —
// a task-insert failure must not roll back a committed stage transition.

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
    return {
      brokerage_id:   brokerageId,
      title:          t.taskTitle!,
      completed:      false,
      priority:       stageDef.owner === 'broker' ? 'high' : 'medium',
      due_at:         dueDays >= 0
        ? new Date(Date.parse(now) + dueDays * 86_400_000).toISOString()
        : null,
      opportunity_id: oppId,
    };
  });

  const { error } = await supabaseAdmin.from('tasks').insert(rows);
  if (error) {
    console.error('[fireTriggerTasks] task insert error (non-fatal):', error.message);
  }
}

// ── Mapper ────────────────────────────────────────────────────────────────────
// Converts a raw Supabase row into the frontend Opportunity shape.
//
// stage_owner in DB is uuid — we do NOT pass it to the frontend stageOwner field.
// Instead we derive the semantic owner role ('agent'|'broker'|'system') from the
// stage definition, which is the authoritative source.

function mapOpportunity(row: any): Opportunity {
  const validPriorities: OpportunityPriority[] = ['high', 'medium', 'low'];

  // Normalise stage — apply legacy mapping, fall back to lead_received
  let stage = String(row.stage ?? 'lead_received');
  if (LEGACY_STAGE_MAP[stage]) stage = LEGACY_STAGE_MAP[stage];
  if (!VALID_STAGES.has(stage)) stage = 'lead_received';

  // pipeline_type — always 'buyer' or 'seller', never undefined.
  // Auto-correct mismatches: if the stage is unambiguous (exists in only one pipeline)
  // and contradicts the stored pipeline_type, trust the stage and log a warning.
  // This prevents valid DB rows from disappearing from the kanban board.
  let pipelineType: PipelineType = row.pipeline_type === 'seller' ? 'seller' : 'buyer';
  const stageInferred = inferPipelineType(stage);
  if (stageInferred !== null && stageInferred !== pipelineType) {
    console.warn(
      `[mapOpportunity] MISMATCH — id=${row.id} stage="${stage}" is ${stageInferred}-only ` +
      `but pipeline_type="${pipelineType}" in DB. Auto-correcting to ${stageInferred}.`,
    );
    pipelineType = stageInferred;
  }

  // Derive semantic owner role from stage definition, NOT from the DB uuid column.
  // The DB uuid is for audit; the role label is what the UI needs.
  const stageDef = getStageDefinition(stage, pipelineType);
  const stageOwner = stageDef?.owner ?? 'agent';

  const documents: PipelineDocument[] = Array.isArray(row.documents) ? row.documents : [];
  const stageHistory: StageHistoryEntry[] = Array.isArray(row.stage_history) ? row.stage_history : [];

  return {
    id:                String(row.id ?? ''),
    contactName:       String(row.contact_name ?? '').trim() || 'Unnamed',
    propertyAddress:   row.property_address   ?? undefined,
    propertyId:        row.property_id         ?? undefined,
    assignedAgentId:   row.assigned_member_id   ?? undefined,
    pipelineType,
    stage:             stage as PipelineStage,
    stageUpdatedAt:    row.stage_updated_at    ?? undefined,
    stageOwner,
    documents,
    stageHistory,
    value:             Number(row.value        ?? 0),
    probability:       Number(row.probability  ?? 15),
    expectedCloseDate: row.expected_close_date
      ? String(row.expected_close_date).slice(0, 10)
      : new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
    priority:          validPriorities.includes(row.priority) ? row.priority : 'medium',
    nextStep:          row.next_step           ?? undefined,
    notes:             Array.isArray(row.notes) ? row.notes : [],
    createdAt:         String(row.created_at   ?? new Date().toISOString()),
    updatedAt:         String(row.updated_at   ?? new Date().toISOString()),
  };
}
