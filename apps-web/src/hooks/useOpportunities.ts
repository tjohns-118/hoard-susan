'use client';

/**
 * useOpportunities — fetches all opportunities from /api/opportunities
 * and writes them unconditionally into useAppStore.opportunities on every mount.
 *
 * Supabase-backed mutations:
 *   createOpportunity  — insert a new deal into the buyer or seller pipeline
 *   moveStage          — transition to any valid stage (fires trigger tasks)
 *   markLost           — exit any deal as lost
 *   assignAgent
 *   addNote
 *   updateDocument     — update document status (not_sent → sent → signed)
 *   advanceStage       — convenience: move to the next stage in the pipeline
 */

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/app/store/useAppStore';
import type { OpportunityPriority } from '@/features/opportunities/types';
import type { PipelineType, PipelineStage, DocumentStatus } from '@/features/pipeline/types';
import { getNextStage } from '@/features/pipeline/definitions';

async function fetchOpportunities() {
  try {
    const res = await fetch('/api/opportunities', { cache: 'no-store' });
    if (!res.ok) {
      console.error('[fetchOpportunities] /api/opportunities responded', res.status);
      return null;
    }
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error('[fetchOpportunities] fetch error:', err);
    return null;
  }
}

export function useOpportunities() {
  const router           = useRouter();
  const opportunities    = useAppStore((s) => s.opportunities);
  const setOpportunities = useAppStore((s) => s.setOpportunities);

  const reload = useCallback(async () => {
    const data = await fetchOpportunities();
    if (data === null) return;
    setOpportunities(data);
  }, [setOpportunities]);

  useEffect(() => { reload(); }, [reload]);

  // ── Shared PATCH helper ──────────────────────────────────────────────────────

  async function patchApi(body: object) {
    const res = await fetch('/api/opportunities', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Opportunity mutation failed');
    router.refresh();
    await reload();
  }

  // ── Create ──────────────────────────────────────────────────────────────────

  async function createOpportunity(fields: {
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
  }) {
    const res = await fetch('/api/opportunities', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(fields),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Create opportunity failed');
    router.refresh();
    await reload();
  }

  // ── Stage transitions ────────────────────────────────────────────────────────

  /** Move to any specific stage.  Fires trigger tasks server-side. */
  async function moveStage(oppId: string, stage: PipelineStage | string) {
    await patchApi({ action: 'moveStage', oppId, stage });
  }

  /**
   * Advance to the next stage in the pipeline automatically.
   * No-ops if the deal is already at the last stage or is lost.
   */
  async function advanceStage(oppId: string) {
    const opp = opportunities.find((o) => o.id === oppId);
    if (!opp || opp.stage === 'lost') return;
    const next = getNextStage(opp.stage, opp.pipelineType);
    if (!next) return;
    await patchApi({ action: 'moveStage', oppId, stage: next });
  }

  /** Mark any deal as lost (terminal exit). */
  async function markLost(oppId: string) {
    await patchApi({ action: 'markLost', oppId });
  }

  // ── Other mutations ──────────────────────────────────────────────────────────

  async function assignAgent(oppId: string, agentId?: string) {
    await patchApi({ action: 'assignAgent', oppId, agentId });
  }

  async function addNote(oppId: string, noteBody: string) {
    await patchApi({ action: 'addNote', oppId, noteBody });
  }

  async function setNextStep(oppId: string, nextStep: string) {
    await patchApi({ action: 'setNextStep', oppId, nextStep });
  }

  /** Update the status of a document on a deal ('not_sent' → 'sent' → 'signed'). */
  async function updateDocument(
    oppId:     string,
    docKey:    string,
    docStatus: DocumentStatus,
  ) {
    await patchApi({ action: 'updateDocument', oppId, docKey, docStatus });
  }

  return {
    opportunities,
    reload,
    createOpportunity,
    moveStage,
    advanceStage,
    markLost,
    assignAgent,
    addNote,
    setNextStep,
    updateDocument,
  };
}
