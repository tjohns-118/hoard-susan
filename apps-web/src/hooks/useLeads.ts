'use client';

/**
 * useLeads — fetches lead-stage contacts from /api/leads (service-role, bypasses RLS)
 * and writes them unconditionally into useAppStore.leads on every mount.
 *
 * Supabase-backed mutations:
 *   createLead          — inserts a new lead-stage contact with optional role + profiles
 *   updateBuyerProfile  — sets buyer_profile JSONB + contact_type on a lead
 *   updateSellerProfile — sets seller_profile JSONB + contact_type on a lead
 *   assignLeadToAgent   — sets assigned_member_id on a lead
 *   markLeadHot         — toggles hot tag + is_hot column on a lead
 *   updateLeadStatus    — updates source_detail (new|contacted|qualified|lost) on a lead
 *   addLeadNote         — inserts a contact_notes row for a lead
 *   convertLead         — promotes lead → active contact (stage change in-place)
 */

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/app/store/useAppStore';
import type { ContactRole, BuyerProfile, SellerProfile } from '@/features/contacts/types';
import type { LeadStatus } from '@/features/opportunities/types';

async function fetchLeads() {
  try {
    const res = await fetch('/api/leads', { cache: 'no-store' });
    if (!res.ok) {
      console.error('[fetchLeads] /api/leads responded', res.status);
      return null;
    }
    const data = await res.json();
    console.log('[fetchLeads] received', Array.isArray(data) ? data.length : '?', 'lead(s)');
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error('[fetchLeads] fetch error:', err);
    return null;
  }
}

export function useLeads() {
  const router   = useRouter();
  const leads    = useAppStore((s) => s.leads);
  const setLeads = useAppStore((s) => s.setLeads);

  const reload = useCallback(async () => {
    const data = await fetchLeads();
    if (data === null) return;   // network error — preserve current state
    setLeads(data);              // unconditional — Supabase is source of truth
  }, [setLeads]);

  useEffect(() => {
    reload();
  }, [reload]);

  // ── Shared PATCH helper ───────────────────────────────────────────────────────

  async function patchApi(body: object) {
    const res = await fetch('/api/leads', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Lead mutation failed');
    router.refresh();
    await reload();
  }

  // ── Create ────────────────────────────────────────────────────────────────────

  async function createLead(fields: {
    fullName:       string;
    email?:         string;
    phone?:         string;
    source?:        string;
    role?:          ContactRole;
    buyerProfile?:  BuyerProfile;
    sellerProfile?: SellerProfile;
  }) {
    const res = await fetch('/api/leads', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(fields),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Create lead failed');
    router.refresh();
    await reload();
  }

  // ── Profile mutations ─────────────────────────────────────────────────────────

  async function updateBuyerProfile(
    leadId:  string,
    profile: BuyerProfile | null,
    role:    ContactRole,
  ) {
    await patchApi({ action: 'updateBuyerProfile', leadId, profile, role });
  }

  async function updateSellerProfile(
    leadId:  string,
    profile: SellerProfile | null,
    role:    ContactRole,
  ) {
    await patchApi({ action: 'updateSellerProfile', leadId, profile, role });
  }

  // ── Agent assignment ──────────────────────────────────────────────────────────

  async function assignLeadToAgent(leadId: string, agentId: string | undefined) {
    await patchApi({ action: 'assignAgent', leadId, agentId: agentId ?? null });
  }

  // ── Hot toggle ────────────────────────────────────────────────────────────────

  async function markLeadHot(leadId: string) {
    await patchApi({ action: 'markHot', leadId });
  }

  // ── Status update ─────────────────────────────────────────────────────────────

  async function updateLeadStatus(leadId: string, status: LeadStatus) {
    await patchApi({ action: 'updateStatus', leadId, status });
  }

  // ── Add note ──────────────────────────────────────────────────────────────────

  async function addLeadNote(leadId: string, note: string) {
    await patchApi({ action: 'addNote', leadId, note });
  }

  // ── Convert ───────────────────────────────────────────────────────────────────
  // Promotes the contact row from stage='lead' to stage='active' in Supabase.
  // Call reload() (and useContacts().reload() if available) after this.

  async function convertLead(leadId: string) {
    await patchApi({ action: 'convert', leadId });
  }

  return {
    leads,
    reload,
    createLead,
    updateBuyerProfile,
    updateSellerProfile,
    assignLeadToAgent,
    markLeadHot,
    updateLeadStatus,
    addLeadNote,
    convertLead,
  };
}
