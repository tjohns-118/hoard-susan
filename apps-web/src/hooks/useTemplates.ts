'use client';

/**
 * useTemplates — fetches all templates from /api/templates
 * and writes them unconditionally into useAppStore.templates on every mount.
 *
 * Supabase-backed mutations:
 *   createTemplate    — insert new template
 *   updateTemplate    — update existing template fields
 *   deleteTemplate    — remove template permanently
 *   duplicateTemplate — create a copy with "(copy)" suffix
 */

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/app/store/useAppStore';
import type { TemplateCategory } from '@/data/mockDb';

async function fetchTemplates() {
  try {
    const res = await fetch('/api/templates', { cache: 'no-store' });
    if (!res.ok) { console.error('[fetchTemplates] /api/templates responded', res.status); return null; }
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error('[fetchTemplates] fetch error:', err);
    return null;
  }
}

export function useTemplates() {
  const router        = useRouter();
  const templates     = useAppStore((s) => s.templates);
  const setTemplates  = useAppStore((s) => s.setTemplates);

  const reload = useCallback(async () => {
    const data = await fetchTemplates();
    if (data === null) return;   // network error — preserve current state
    setTemplates(data);
  }, [setTemplates]);

  useEffect(() => { reload(); }, [reload]);

  // ── Create ────────────────────────────────────────────────────────────────────

  async function createTemplate(fields: {
    name:      string;
    category:  TemplateCategory;
    body:      string;
    tags:      string[];
    notes?:    string;
  }) {
    const res = await fetch('/api/templates', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(fields),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Create template failed');
    router.refresh();
    await reload();
  }

  // ── Update ────────────────────────────────────────────────────────────────────

  async function updateTemplate(id: string, fields: {
    name:      string;
    category:  TemplateCategory;
    body:      string;
    tags:      string[];
    notes?:    string;
  }) {
    const res = await fetch('/api/templates', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id, ...fields }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Update template failed');
    router.refresh();
    await reload();
  }

  // ── Delete ────────────────────────────────────────────────────────────────────

  async function deleteTemplate(id: string) {
    const res = await fetch('/api/templates', {
      method:  'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Delete template failed');
    router.refresh();
    await reload();
  }

  // ── Duplicate ─────────────────────────────────────────────────────────────────

  async function duplicateTemplate(id: string) {
    const src = templates.find((t) => t.id === id);
    if (!src) return;
    await createTemplate({
      name:     `${src.name} (copy)`,
      category: src.category,
      body:     src.body,
      tags:     src.tags,
      notes:    src.notes,
    });
  }

  return {
    templates,
    reload,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    duplicateTemplate,
  };
}
