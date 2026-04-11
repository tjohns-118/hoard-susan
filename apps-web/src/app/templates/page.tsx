'use client';

import { useMemo, useState, useCallback } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { StatCard } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import { useAppStore } from '@/app/store/useAppStore';
import type { TemplateCategory } from '@/data/mockDb';

// ── Category metadata ─────────────────────────────────────────────
const CAT_META: Record<TemplateCategory | 'all', { label: string; color: string; bg: string; border: string }> = {
  all:        { label: 'All',        color: 'var(--r-text-2)',     bg: 'rgba(200,164,92,0.03)',  border: 'var(--r-border)' },
  buyer:      { label: 'Buyer',      color: '#7ca4cc',             bg: 'rgba(124,164,204,0.08)', border: 'rgba(124,164,204,0.24)' },
  seller:     { label: 'Seller',     color: 'var(--r-gold)',       bg: 'var(--r-gold-faint)',    border: 'var(--r-border)' },
  'follow-up':{ label: 'Follow-Up',  color: 'var(--r-gold-bright)',bg: 'var(--r-gold-faint)',    border: 'var(--r-border)' },
  deal:       { label: 'Deal',       color: '#9b8ab4',             bg: 'rgba(155,138,180,0.08)', border: 'rgba(155,138,180,0.24)' },
  internal:   { label: 'Internal',   color: 'var(--r-text-3)',     bg: 'rgba(200,164,92,0.03)',  border: 'var(--r-border)' },
  custom:     { label: 'Custom',     color: 'var(--r-success)',    bg: 'var(--r-success-bg)',    border: 'var(--r-success-border)' },
};

const CAT_ORDER: TemplateCategory[] = ['buyer', 'seller', 'follow-up', 'deal', 'internal', 'custom'];

// ── Placeholder registry ──────────────────────────────────────────
const PLACEHOLDER_DOCS: Record<string, { label: string; example: string }> = {
  '{{client_name}}':      { label: 'Client full name',        example: 'Jennifer Walsh' },
  '{{property_name}}':    { label: 'Property name / address', example: 'Twin Oaks Ranch' },
  '{{appointment_time}}': { label: 'Showing or meeting time', example: 'Tue Apr 8 at 11:00 AM' },
  '{{agent_name}}':       { label: 'Assigned agent',          example: 'Susan Yoder' },
  '{{broker_name}}':      { label: 'Brokerage / broker',      example: 'Susan Yoder' },
  '{{price}}':            { label: 'Listed price',            example: '$1,850,000' },
  '{{offer_amount}}':     { label: 'Offer or counter amount', example: '$1,750,000' },
  '{{close_date}}':       { label: 'Target closing date',     example: 'April 12, 2026' },
  '{{days_on_market}}':   { label: 'Days on market',          example: '52 days' },
  '{{county}}':           { label: 'Property county',         example: 'Kerr County' },
};

// Quick-access use-case chips
const USE_CASES = [
  { label: 'New lead follow-up',     templateName: 'Initial Buyer Follow-Up' },
  { label: 'Showing confirmation',   templateName: 'Showing Confirmation' },
  { label: 'Post-showing',           templateName: 'Post-Showing Follow-Up' },
  { label: 'Price reduction',        templateName: 'Price Reduction Conversation' },
  { label: 'Closing congrats',       templateName: 'Post-Close Congratulations' },
  { label: '7-day re-engage',        templateName: '7-Day No Response Follow-Up' },
];

// Render body with highlighted {{tokens}}
function BodyWithTokens({ body }: { body: string }) {
  const parts = body.split(/({{[^}]+}})/g);
  return (
    <>
      {parts.map((part, i) =>
        /^{{[^}]+}}$/.test(part) ? (
          <span
            key={i}
            style={{
              background: 'var(--r-gold-faint)',
              border: '1px solid var(--r-border)',
              borderRadius: 4,
              padding: '1px 5px',
              color: 'var(--r-gold)',
              fontFamily: 'monospace',
              fontSize: '0.9em',
              fontWeight: 600,
            }}
          >
            {part}
          </span>
        ) : (
          <span key={i} style={{ whiteSpace: 'pre-wrap' }}>{part}</span>
        )
      )}
    </>
  );
}

function extractTokens(body: string): string[] {
  return [...new Set(body.match(/{{[^}]+}}/g) ?? [])];
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

type Mode = 'view' | 'edit' | 'create';

// ── Empty edit state ─────────────────────────────────────────────
const EMPTY_FORM = { name: '', category: 'buyer' as TemplateCategory, body: '', notes: '', tags: '' };

export default function TemplatesPage() {
  const templates         = useAppStore((s) => s.templates);
  const createTemplate    = useAppStore((s) => s.createTemplate);
  const updateTemplate    = useAppStore((s) => s.updateTemplate);
  const deleteTemplate    = useAppStore((s) => s.deleteTemplate);
  const duplicateTemplate = useAppStore((s) => s.duplicateTemplate);

  // ── UI state ─────────────────────────────────────────────────────
  const [selectedId,  setSelectedId]  = useState<string | null>(templates[0]?.id ?? null);
  const [mode,        setMode]        = useState<Mode>('view');
  const [search,      setSearch]      = useState('');
  const [catFilter,   setCatFilter]   = useState<TemplateCategory | 'all'>('all');
  const [sort,        setSort]        = useState<'recent' | 'name'>('name');
  const [copied,      setCopied]      = useState(false);
  const [confirmDel,  setConfirmDel]  = useState(false);

  // ── Edit form ────────────────────────────────────────────────────
  const [form, setForm] = useState(EMPTY_FORM);

  function openEdit(id: string) {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    setForm({ name: t.name, category: t.category, body: t.body, notes: t.notes ?? '', tags: t.tags.join(', ') });
    setMode('edit');
  }

  function openCreate(fromId?: string) {
    if (fromId) {
      const t = templates.find((x) => x.id === fromId);
      if (t) setForm({ name: `${t.name} (copy)`, category: t.category, body: t.body, notes: t.notes ?? '', tags: t.tags.join(', ') });
    } else {
      setForm(EMPTY_FORM);
    }
    setMode('create');
  }

  function handleSave() {
    if (!form.name.trim() || !form.body.trim()) return;
    const tags = form.tags.split(',').map((s) => s.trim()).filter(Boolean);
    if (mode === 'create') {
      createTemplate({ name: form.name.trim(), category: form.category, body: form.body, tags, notes: form.notes || undefined });
    } else if (mode === 'edit' && selectedId) {
      updateTemplate(selectedId, { name: form.name.trim(), category: form.category, body: form.body, tags, notes: form.notes || undefined });
    }
    setMode('view');
  }

  function handleCancel() { setMode('view'); setForm(EMPTY_FORM); }

  function handleDelete(id: string) {
    if (!confirmDel) { setConfirmDel(true); return; }
    deleteTemplate(id);
    setSelectedId(templates.find((t) => t.id !== id)?.id ?? null);
    setConfirmDel(false);
    setMode('view');
  }

  function handleCopy(body: string) {
    navigator.clipboard.writeText(body).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const jumpTo = useCallback((name: string) => {
    const t = templates.find((x) => x.name === name);
    if (t) { setSelectedId(t.id); setMode('view'); }
  }, [templates]);

  // ── Filtered + sorted list ────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...templates];
    if (catFilter !== 'all') list = list.filter((t) => t.category === catFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((t) => t.name.toLowerCase().includes(q) || t.body.toLowerCase().includes(q) || t.tags.some((tag) => tag.includes(q)));
    }
    return sort === 'name'
      ? list.sort((a, b) => a.name.localeCompare(b.name))
      : list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [templates, catFilter, search, sort]);

  const selected = templates.find((t) => t.id === selectedId) ?? null;
  const tokens   = selected ? extractTokens(selected.body) : [];

  // ── KPI ──────────────────────────────────────────────────────────
  const byCategory = (cat: TemplateCategory) => templates.filter((t) => t.category === cat).length;
  const recentCount = templates.filter((t) => new Date(t.updatedAt) >= new Date('2026-04-01T00:00:00.000Z')).length;

  return (
    <AppShell>
      {/* Header */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 34, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--r-text)', lineHeight: 1.05, fontFamily: 'var(--r-font-serif)' }}>
              Communication Library
            </h1>
            <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--r-text-3)' }}>
              Proven messaging for every stage of the broker relationship — ready to copy and send.
            </p>
          </div>
          <button
            onClick={() => openCreate()}
            className="r-btn-gold"
            style={{
              padding: '9px 20px',
              borderRadius: 10,
              border: '1px solid var(--r-border)',
              background: 'var(--r-gold-faint)',
              color: 'var(--r-gold-bright)',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            + New Template
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 18 }}>
        <StatCard label="Total"       value={templates.length}       subtext="in library" />
        <StatCard label="Buyer"       value={byCategory('buyer')}    subtext="buyer-facing" />
        <StatCard label="Seller"      value={byCategory('seller')}   subtext="seller-facing" />
        <StatCard label="Follow-Up"   value={byCategory('follow-up')} subtext="nurture & re-engage" />
        <StatCard label="Updated"     value={recentCount}            subtext="since April 1" />
      </div>

      {/* Quick-access use cases */}
      <div style={{ display: 'flex', gap: 7, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--r-text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', flexShrink: 0 }}>Quick access:</span>
        {USE_CASES.map(({ label, templateName }) => (
          <button
            key={label}
            onClick={() => jumpTo(templateName)}
            className="r-tab"
            style={{
              padding: '5px 12px',
              borderRadius: 7,
              border: '1px solid var(--r-border)',
              background: 'var(--r-grad-card)',
              color: 'var(--r-text-2)',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Main split pane */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>

        {/* ── Left: Library panel ──────────────────────────────── */}
        <div style={{ width: 340, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Search + sort */}
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search templates…"
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid var(--r-border)',
                background: 'var(--r-grad-card)',
                color: 'var(--r-text)',
                fontSize: 12,
                outline: 'none',
              }}
            />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as 'recent' | 'name')}
              style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--r-border)', background: 'var(--r-grad-card)', color: 'var(--r-text-2)', fontSize: 12, cursor: 'pointer' }}
            >
              <option value="name">A–Z</option>
              <option value="recent">Recent</option>
            </select>
          </div>

          {/* Category filters */}
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {(['all', ...CAT_ORDER] as (TemplateCategory | 'all')[]).map((cat) => {
              const active = catFilter === cat;
              const cm = CAT_META[cat];
              return (
                <button
                  key={cat}
                  onClick={() => setCatFilter(cat)}
                  className="r-tab"
                  style={{
                    padding: '5px 11px',
                    borderRadius: 7,
                    border: active ? `1px solid ${cm.border}` : '1px solid var(--r-border)',
                    background: active ? cm.bg : 'var(--r-grad-card)',
                    color: active ? cm.color : 'var(--r-text-3)',
                    fontSize: 11,
                    fontWeight: active ? 700 : 500,
                    cursor: 'pointer',
                  }}
                >
                  {cm.label}
                </button>
              );
            })}
          </div>

          {/* Template list */}
          <div className="template-list-scroll" style={{ display: 'flex', flexDirection: 'column', gap: 5, overflowY: 'auto', maxHeight: 'calc(100vh - 300px)' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', fontSize: 12, color: 'var(--r-text-3)' }}>No templates match.</div>
            ) : (
              filtered.map((t) => {
                const cm = CAT_META[t.category];
                const isSelected = selectedId === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => { setSelectedId(t.id); setMode('view'); setConfirmDel(false); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      textAlign: 'left',
                      padding: 0,
                      minHeight: 44,
                      flexShrink: 0,
                      borderRadius: 11,
                      border: isSelected ? '1px solid var(--r-border)' : `1px solid ${cm.border}`,
                      background: isSelected ? 'var(--r-gold-faint)' : cm.bg,
                      cursor: 'pointer',
                      overflow: 'hidden',
                      width: '100%',
                    }}
                  >
                    <div style={{ width: 3, flexShrink: 0, alignSelf: 'stretch', background: cm.color }} />
                    <span style={{ flex: 1, minWidth: 0, padding: '0 12px', fontSize: 13, fontWeight: 700, color: 'var(--r-text)', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.name}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ── Right: Detail / Edit panel ───────────────────────── */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {mode === 'view' && selected ? (
            <ViewPanel
              template={selected}
              tokens={tokens}
              copied={copied}
              confirmDel={confirmDel}
              onCopy={() => handleCopy(selected.body)}
              onEdit={() => openEdit(selected.id)}
              onDuplicate={() => { duplicateTemplate(selected.id); }}
              onCreateFrom={() => openCreate(selected.id)}
              onDelete={() => handleDelete(selected.id)}
              onCancelDel={() => setConfirmDel(false)}
            />
          ) : mode === 'view' && !selected ? (
            <div style={{ padding: '60px 24px', textAlign: 'center', borderRadius: 16, border: '1px solid var(--r-border)', background: 'var(--r-grad-card)', color: 'var(--r-text-3)', fontSize: 13 }}>
              Select a template from the library.
            </div>
          ) : (
            <EditPanel
              mode={mode}
              form={form}
              onChange={(f) => setForm((prev) => ({ ...prev, ...f }))}
              onSave={handleSave}
              onCancel={handleCancel}
            />
          )}
        </div>
      </div>
    </AppShell>
  );
}

// ── View panel ─────────────────────────────────────────────────────

import type { TemplateRecord } from '@/data/mockDb';

function ViewPanel({
  template, tokens, copied, confirmDel,
  onCopy, onEdit, onDuplicate, onCreateFrom, onDelete, onCancelDel,
}: {
  template: TemplateRecord;
  tokens: string[];
  copied: boolean;
  confirmDel: boolean;
  onCopy: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onCreateFrom: () => void;
  onDelete: () => void;
  onCancelDel: () => void;
}) {
  const cm = CAT_META[template.category];
  const audience = template.category === 'internal' ? 'Internal only' : template.category === 'buyer' ? 'Buyer-facing' : template.category === 'seller' ? 'Seller-facing' : 'General';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Header card */}
      <div style={{ padding: '18px 22px', borderRadius: 16, border: `1px solid ${cm.border}`, background: cm.bg }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--r-text)', letterSpacing: '-0.02em', lineHeight: 1.2, fontFamily: 'var(--r-font-serif)' }}>
            {template.name}
          </h2>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase', color: cm.color, background: cm.bg, border: `1px solid ${cm.border}`, borderRadius: 6, padding: '3px 9px' }}>
              {cm.label}
            </span>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--r-text-3)', background: 'var(--r-grad-card)', border: '1px solid var(--r-border)', borderRadius: 6, padding: '3px 9px' }}>
              {audience}
            </span>
          </div>
        </div>
        {template.notes && (
          <div style={{ fontSize: 12, color: 'var(--r-text-2)', lineHeight: 1.6, marginBottom: 10 }}>
            {template.notes}
          </div>
        )}
        {template.tags.length > 0 && (
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {template.tags.map((tag) => (
              <span key={tag} style={{ fontSize: 10, color: 'var(--r-gold)', background: 'var(--r-gold-faint)', border: '1px solid var(--r-border)', borderRadius: 4, padding: '1px 7px' }}>
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Action bar */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          onClick={onCopy}
          className="r-btn-gold"
          style={{
            padding: '8px 18px',
            borderRadius: 9,
            border: copied ? '1px solid var(--r-success-border)' : '1px solid var(--r-border)',
            background: copied ? 'var(--r-success-bg)' : 'var(--r-gold-faint)',
            color: copied ? 'var(--r-success)' : 'var(--r-gold-bright)',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {copied ? '✓ Copied!' : '⎘ Copy'}
        </button>
        <button onClick={onEdit} style={actionBtn}>Edit</button>
        <button onClick={onDuplicate} style={actionBtn}>Duplicate</button>
        <button onClick={onCreateFrom} style={actionBtn}>New from this</button>
        <div style={{ marginLeft: 'auto' }}>
          {confirmDel ? (
            <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--r-danger)' }}>Are you sure?</span>
              <button onClick={onDelete} style={{ ...actionBtn, color: 'var(--r-danger)', borderColor: 'var(--r-danger-border)', background: 'var(--r-danger-bg)' }}>Yes, delete</button>
              <button onClick={onCancelDel} style={actionBtn}>Cancel</button>
            </div>
          ) : (
            <button onClick={onDelete} style={{ ...actionBtn, color: 'var(--r-danger)', opacity: 0.7 }}>Delete</button>
          )}
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '20px 22px', borderRadius: 14, border: '1px solid var(--r-border)', background: 'var(--r-grad-card)', fontSize: 13, lineHeight: 1.75, color: 'var(--r-text-2)', fontFamily: 'inherit' }}>
        <BodyWithTokens body={template.body} />
      </div>

      {/* Placeholder legend */}
      {tokens.length > 0 && (
        <div style={{ padding: '16px 20px', borderRadius: 14, border: '1px solid var(--r-border)', background: 'var(--r-gold-faint)' }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--r-gold)', marginBottom: 12 }}>
            Placeholder guide — {tokens.length} token{tokens.length !== 1 ? 's' : ''} in this template
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '8px 16px' }}>
            {tokens.map((token) => {
              const doc = PLACEHOLDER_DOCS[token];
              return (
                <div key={token} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: 'var(--r-gold)', background: 'var(--r-gold-faint)', border: '1px solid var(--r-border)', borderRadius: 4, padding: '2px 6px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {token}
                  </span>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--r-text)' }}>{doc?.label ?? token.replace(/{{|}}/g, '')}</div>
                    {doc && <div style={{ fontSize: 10, color: 'var(--r-text-3)' }}>e.g. {doc.example}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Meta footer */}
      <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--r-text-3)', paddingTop: 4 }}>
        <span>Created {fmtDate(template.createdAt)}</span>
        <span>Updated {fmtDate(template.updatedAt)}</span>
        <span>{template.body.split(/\s+/).length} words</span>
        <span>{tokens.length} placeholder{tokens.length !== 1 ? 's' : ''}</span>
      </div>
    </div>
  );
}

const actionBtn: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: 9,
  border: '1px solid var(--r-border)',
  background: 'var(--r-grad-card)',
  color: 'var(--r-text-2)',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
};

// ── Edit / Create panel ────────────────────────────────────────────

function EditPanel({
  mode, form, onChange, onSave, onCancel,
}: {
  mode: Mode;
  form: { name: string; category: TemplateCategory; body: string; notes: string; tags: string };
  onChange: (f: Partial<typeof form>) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const isValid = form.name.trim().length > 0 && form.body.trim().length > 0;
  const previewTokens = extractTokens(form.body);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Panel header */}
      <div style={{ padding: '16px 20px', borderRadius: 14, border: '1px solid var(--r-border)', background: 'var(--r-grad-card)' }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--r-text)', marginBottom: 4, fontFamily: 'var(--r-font-serif)' }}>
          {mode === 'create' ? 'New Template' : 'Edit Template'}
        </div>
        <div style={{ fontSize: 12, color: 'var(--r-text-3)' }}>
          {mode === 'create' ? 'Create a new reusable message template.' : 'Make changes and save.'}
        </div>
      </div>

      {/* Name + Category row */}
      <div style={{ display: 'flex', gap: 10 }}>
        <input
          value={form.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Template name…"
          style={{ flex: 2, padding: '9px 13px', borderRadius: 9, border: '1px solid var(--r-border)', background: 'var(--r-grad-card)', color: 'var(--r-text)', fontSize: 13, fontWeight: 600, outline: 'none' }}
        />
        <select
          value={form.category}
          onChange={(e) => onChange({ category: e.target.value as TemplateCategory })}
          style={{ flex: 1, padding: '9px 12px', borderRadius: 9, border: `1px solid ${CAT_META[form.category].border}`, background: CAT_META[form.category].bg, color: CAT_META[form.category].color, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
        >
          {CAT_ORDER.map((cat) => <option key={cat} value={cat}>{CAT_META[cat].label}</option>)}
        </select>
      </div>

      {/* Notes */}
      <input
        value={form.notes}
        onChange={(e) => onChange({ notes: e.target.value })}
        placeholder="Intended use / notes (optional)…"
        style={{ padding: '9px 13px', borderRadius: 9, border: '1px solid var(--r-border)', background: 'var(--r-grad-card)', color: 'var(--r-text-2)', fontSize: 12, outline: 'none' }}
      />

      {/* Body */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--r-text-3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Message body</span>
          {previewTokens.length > 0 && (
            <span style={{ fontSize: 10, color: 'var(--r-gold)' }}>{previewTokens.length} placeholder{previewTokens.length !== 1 ? 's' : ''} detected</span>
          )}
        </div>
        <textarea
          value={form.body}
          onChange={(e) => onChange({ body: e.target.value })}
          placeholder={`Write your template here...\n\nUse {{client_name}}, {{property_name}}, {{agent_name}}, {{appointment_time}}, etc. for placeholders.`}
          rows={14}
          style={{
            width: '100%',
            padding: '13px 16px',
            borderRadius: 11,
            border: '1px solid var(--r-border)',
            background: 'var(--r-grad-card)',
            color: 'var(--r-text)',
            fontSize: 13,
            lineHeight: 1.7,
            fontFamily: 'inherit',
            resize: 'vertical',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Placeholder helper */}
      <div style={{ padding: '12px 16px', borderRadius: 10, border: '1px solid var(--r-border)', background: 'var(--r-gold-faint)' }}>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--r-gold)', marginBottom: 8 }}>Available placeholders</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {Object.keys(PLACEHOLDER_DOCS).map((token) => (
            <button
              key={token}
              onClick={() => onChange({ body: form.body + token })}
              title={PLACEHOLDER_DOCS[token].label}
              style={{ fontFamily: 'monospace', fontSize: 10, fontWeight: 700, color: 'var(--r-gold)', background: 'var(--r-gold-faint)', border: '1px solid var(--r-border)', borderRadius: 4, padding: '2px 7px', cursor: 'pointer' }}
            >
              {token}
            </button>
          ))}
        </div>
      </div>

      {/* Tags */}
      <input
        value={form.tags}
        onChange={(e) => onChange({ tags: e.target.value })}
        placeholder="Tags (comma-separated)…"
        style={{ padding: '9px 13px', borderRadius: 9, border: '1px solid var(--r-border)', background: 'var(--r-grad-card)', color: 'var(--r-text-2)', fontSize: 12, outline: 'none' }}
      />

      {/* Save / Cancel */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={onSave}
          disabled={!isValid}
          className={isValid ? 'r-btn-gold' : ''}
          style={{
            padding: '10px 24px',
            borderRadius: 9,
            border: isValid ? '1px solid var(--r-border)' : '1px solid var(--r-border)',
            background: isValid ? 'var(--r-gold-faint)' : 'var(--r-grad-card)',
            color: isValid ? 'var(--r-gold-bright)' : 'var(--r-text-3)',
            fontSize: 13,
            fontWeight: 700,
            cursor: isValid ? 'pointer' : 'default',
            opacity: isValid ? 1 : 0.5,
          }}
        >
          {mode === 'create' ? 'Create Template' : 'Save Changes'}
        </button>
        <button onClick={onCancel} style={actionBtn}>Cancel</button>
      </div>
    </div>
  );
}
