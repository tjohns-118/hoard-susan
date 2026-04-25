'use client';

/**
 * useContacts — fetches real contact data from /api/contacts (service-role,
 * bypasses RLS) and writes it unconditionally into useAppStore.contacts on
 * every mount.
 *
 * Supabase-backed mutations:
 *   markContactHot         — toggles is_hot + 'hot' tag
 *   addContactNote         — inserts into contact_notes, bumps last_activity_at
 *   assignContactToAgent   — updates assigned_member_id
 *   createContact          — inserts a new contact (stage='active')
 *   updateBuyerProfile     — sets buyer_profile JSONB + contact_type
 *   updateSellerProfile    — sets seller_profile JSONB + contact_type
 *
 * Zustand-only mutations (not yet wired to Supabase):
 *   addContactFollowUpTask     (tasks not wired yet)
 *   pushContactToOpportunities (opps not wired yet)
 */

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/app/store/useAppStore';
import type { BuyerProfile, SellerProfile, ContactRole, Contact } from '@/features/contacts/types';

async function fetchContacts() {
  try {
    const res = await fetch('/api/contacts', { cache: 'no-store' });
    if (!res.ok) {
      console.error('[fetchContacts] /api/contacts responded', res.status);
      return null;
    }
    const data = await res.json();
    console.log('[fetchContacts] received', Array.isArray(data) ? data.length : '?', 'contact(s)');
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error('[fetchContacts] fetch error:', err);
    return null;
  }
}

export function useContacts() {
  const router      = useRouter();
  const contacts    = useAppStore((s) => s.contacts);
  const setContacts = useAppStore((s) => s.setContacts);

  const reload = useCallback(async () => {
    const data = await fetchContacts();
    if (data === null) return;
    setContacts(data);
  }, [setContacts]);

  useEffect(() => {
    reload();
  }, [reload]);

  // ── Shared PATCH helper ───────────────────────────────────────────────────────

  async function patchApi(body: object) {
    const res = await fetch('/api/contacts', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Contact mutation failed');
    router.refresh();
    await reload();
  }

  // ── Existing mutations ────────────────────────────────────────────────────────

  async function markContactHot(contactId: string) {
    await patchApi({ action: 'markHot', contactId });
  }

  async function addContactNote(contactId: string, body: string) {
    await patchApi({ action: 'addNote', contactId, noteBody: body });
  }

  async function assignContactToAgent(contactId: string, agentId?: string) {
    await patchApi({ action: 'assignAgent', contactId, assignedMemberId: agentId ?? null });
  }

  // ── Create ────────────────────────────────────────────────────────────────────

  async function createContact(fields: {
    fullName:         string;
    email?:           string;
    phone?:           string;
    source?:          string;
    role?:            ContactRole;
    buyerProfile?:    BuyerProfile;
    sellerProfile?:   SellerProfile;
    newsletterOptIn?: boolean;
    newsletterTags?:  string[];
  }) {
    const res = await fetch('/api/contacts', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(fields),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Create contact failed');
    router.refresh();
    await reload();
  }

  // ── Profile mutations ─────────────────────────────────────────────────────────

  async function updateBuyerProfile(
    contactId: string,
    profile:   BuyerProfile | null,
    role:      ContactRole,
  ) {
    await patchApi({ action: 'updateBuyerProfile', contactId, profile, role });
  }

  async function updateSellerProfile(
    contactId: string,
    profile:   SellerProfile | null,
    role:      ContactRole,
  ) {
    await patchApi({ action: 'updateSellerProfile', contactId, profile, role });
  }

  // ── Edit core fields ──────────────────────────────────────────────────────────

  async function updateContact(
    contactId: string,
    fields: Pick<Contact, 'fullName' | 'role'> & { email?: string; phone?: string; source?: string; newsletterOptIn?: boolean; newsletterTags?: string[] },
  ) {
    await patchApi({
      action:          'updateContact',
      contactId,
      fullName:        fields.fullName,
      email:           fields.email  ?? null,
      phone:           fields.phone  ?? null,
      source:          fields.source ?? null,
      role:            fields.role,
      newsletterOptIn: fields.newsletterOptIn,
      newsletterTags:  fields.newsletterTags,
    });
  }

  // ── Archive / Unarchive ───────────────────────────────────────────────────────

  async function archiveContact(contactId: string) {
    await patchApi({ action: 'archiveContact', contactId });
  }

  async function unarchiveContact(contactId: string) {
    await patchApi({ action: 'unarchiveContact', contactId });
  }

  // ── Permanent delete ──────────────────────────────────────────────────────────

  async function deleteContact(contactId: string) {
    const res = await fetch('/api/contacts', {
      method:  'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ contactId }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Delete contact failed');
    router.refresh();
    await reload();
  }

  return {
    contacts,
    reload,
    markContactHot,
    addContactNote,
    assignContactToAgent,
    createContact,
    updateContact,
    archiveContact,
    unarchiveContact,
    deleteContact,
    updateBuyerProfile,
    updateSellerProfile,
  };
}
