'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { StatCard } from '@/components/ui/StatCard';
import { useTemplates } from '@/hooks/useTemplates';
import { useAppStore } from '@/app/store/useAppStore';
import { useAgents } from '@/hooks/useAgents';
import type { TemplateCategory, TemplateRecord } from '@/data/mockDb';

// ── Types ────────────────────────────────────────────────────────────────────

interface NewsletterContact {
  id:               string;
  fullName:         string;
  email:            string;
  phone:            string;
  newsletterTags:   string[];
  kind:             'contact' | 'lead';
  assignedMemberId: string | null;
}

interface EmailLog {
  id:         string;
  subject:    string;
  to_email:   string;
  provider:   string;
  status:     'sent' | 'failed';
  error:      string | null;
  created_at: string;
}

// ── Template constants ────────────────────────────────────────────────────────

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

const USE_CASES = [
  { label: 'New lead follow-up',   templateName: 'Initial Buyer Follow-Up' },
  { label: 'Showing confirmation', templateName: 'Showing Confirmation' },
  { label: 'Post-showing',         templateName: 'Post-Showing Follow-Up' },
  { label: 'Price reduction',      templateName: 'Price Reduction Conversation' },
  { label: 'Closing congrats',     templateName: 'Post-Close Congratulations' },
  { label: '7-day re-engage',      templateName: '7-Day No Response Follow-Up' },
];

const TOKEN_TO_PLAIN: Record<string, string> = {
  '{{client_name}}':      '[Client Name]',
  '{{property_name}}':    '[Property Address]',
  '{{appointment_time}}': '[Appointment Time]',
  '{{agent_name}}':       '[Agent Name]',
  '{{broker_name}}':      '[Broker / Brokerage]',
  '{{price}}':            '[Listed Price]',
  '{{offer_amount}}':     '[Offer Amount]',
  '{{close_date}}':       '[Closing Date]',
  '{{days_on_market}}':   '[Days on Market]',
  '{{county}}':           '[County]',
};

const TAG_COLORS: Record<string, { color: string; bg: string }> = {
  buyers:    { color: '#7ca4cc',           bg: 'rgba(124,164,204,0.12)' },
  sellers:   { color: 'var(--r-gold)',     bg: 'var(--r-gold-faint)' },
  investors: { color: '#9b8ab4',           bg: 'rgba(155,138,180,0.12)' },
  newsletter:{ color: 'var(--r-text-2)',   bg: 'rgba(200,164,92,0.06)' },
};

const actionBtn: React.CSSProperties = {
  padding: '8px 16px', borderRadius: 9, border: '1px solid var(--r-border)',
  background: 'var(--r-grad-card)', color: 'var(--r-text-2)',
  fontSize: 12, fontWeight: 600, cursor: 'pointer',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 11px', borderRadius: 7, fontSize: 12,
  border: '1px solid var(--r-border)', background: 'rgba(200,164,92,0.04)',
  color: 'var(--r-text)', outline: 'none', boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: 'var(--r-text-3)',
  textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4, display: 'block',
};

const EMPTY_FORM = { name: '', category: 'buyer' as TemplateCategory, body: '', notes: '', tags: '' };

type TplMode = 'view' | 'edit' | 'create';
type TplViewMode = 'automation' | 'plain';
type CampStep = 1 | 2 | 3 | 4;

// ── Utilities ─────────────────────────────────────────────────────────────────

function toPlainText(body: string): string {
  return body.replace(/{{([^}]+)}}/g, (match) =>
    TOKEN_TO_PLAIN[match] ??
    `[${match.slice(2, -2).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}]`
  );
}

function extractTokens(body: string): string[] {
  return [...new Set(body.match(/{{[^}]+}}/g) ?? [])];
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

// ── Sub-components ────────────────────────────────────────────────────────────

function BodyWithTokens({ body }: { body: string }) {
  const parts = body.split(/({{[^}]+}})/g);
  return (
    <>
      {parts.map((part, i) =>
        /^{{[^}]+}}$/.test(part) ? (
          <span key={i} style={{
            background: 'var(--r-gold-faint)', border: '1px solid var(--r-border)',
            borderRadius: 4, padding: '1px 5px', color: 'var(--r-gold)',
            fontFamily: 'monospace', fontSize: '0.9em', fontWeight: 600,
          }}>
            {part}
          </span>
        ) : (
          <span key={i} style={{ whiteSpace: 'pre-wrap' }}>{part}</span>
        )
      )}
    </>
  );
}

function TagChip({ tag }: { tag: string }) {
  const s = TAG_COLORS[tag] ?? { color: 'var(--r-text-3)', bg: 'rgba(200,164,92,0.04)' };
  return (
    <span style={{
      fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em',
      color: s.color, background: s.bg, border: '1px solid var(--r-border)',
      borderRadius: 4, padding: '2px 7px', whiteSpace: 'nowrap',
    }}>
      {tag}
    </span>
  );
}

function CopyBtn({ list, label }: { list: { name: string; email: string }[]; label: string }) {
  const [copied, setCopied] = useState(false);
  function doCopy() {
    const text = list.map((s) => `${s.name} <${s.email}>`).join(', ');
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    });
  }
  return (
    <button onClick={doCopy} style={{
      padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer',
      border: copied ? '1px solid var(--r-success-border)' : '1px solid var(--r-border)',
      background: copied ? 'var(--r-success-bg)' : 'var(--r-gold-faint)',
      color: copied ? 'var(--r-success)' : 'var(--r-gold-bright)', whiteSpace: 'nowrap',
    }}>
      {copied ? '✓ Copied' : label}
    </button>
  );
}

// ── ViewPanel ─────────────────────────────────────────────────────────────────

function ViewPanel({
  template, tokens, copied, confirmDel,
  onCopy, onEdit, onDuplicate, onCreateFrom, onDelete, onCancelDel,
}: {
  template: TemplateRecord; tokens: string[]; copied: boolean; confirmDel: boolean;
  onCopy: (text: string) => void; onEdit: () => void; onDuplicate: () => void;
  onCreateFrom: () => void; onDelete: () => void; onCancelDel: () => void;
}) {
  const [viewMode, setViewMode] = useState<TplViewMode>('automation');
  const cm = CAT_META[template.category];
  const audience = template.category === 'internal' ? 'Internal only'
    : template.category === 'buyer' ? 'Buyer-facing'
    : template.category === 'seller' ? 'Seller-facing' : 'General';
  const displayBody = viewMode === 'plain' ? toPlainText(template.body) : template.body;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
          <div style={{ fontSize: 12, color: 'var(--r-text-2)', lineHeight: 1.6, marginBottom: 10 }}>{template.notes}</div>
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

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={() => onCopy(displayBody)} className="r-btn-gold" style={{
          padding: '8px 18px', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer',
          border: copied ? '1px solid var(--r-success-border)' : '1px solid var(--r-border)',
          background: copied ? 'var(--r-success-bg)' : 'var(--r-gold-faint)',
          color: copied ? 'var(--r-success)' : 'var(--r-gold-bright)',
        }}>
          {copied ? '✓ Copied!' : viewMode === 'plain' ? '⎘ Copy Plain Text' : '⎘ Copy'}
        </button>
        <button onClick={onEdit} style={actionBtn}>Edit</button>
        <button onClick={onDuplicate} style={actionBtn}>Duplicate</button>
        <button onClick={onCreateFrom} style={actionBtn}>New from this</button>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 0, background: 'rgba(200,164,92,0.04)', borderRadius: 8, padding: 3, border: '1px solid var(--r-border)' }}>
          {(['automation', 'plain'] as TplViewMode[]).map((m) => (
            <button key={m} onClick={() => setViewMode(m)} style={{
              padding: '5px 12px', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer',
              border: viewMode === m ? '1px solid var(--r-border)' : '1px solid transparent',
              background: viewMode === m ? 'var(--r-gold-faint)' : 'transparent',
              color: viewMode === m ? 'var(--r-gold-bright)' : 'var(--r-text-3)',
              letterSpacing: '0.04em', textTransform: 'uppercase',
            }}>
              {m === 'automation' ? '{{tokens}}' : '[Plain text]'}
            </button>
          ))}
        </div>
      </div>

      <div style={{ fontSize: 11, color: 'var(--r-text-3)', marginTop: -8, paddingBottom: 2 }}>
        {viewMode === 'automation'
          ? 'Automation view — tokens substituted by the system. Copy for workflow integrations.'
          : 'Copy/paste view — tokens replaced with readable placeholders. Copy and edit before sending.'}
      </div>

      <div style={{ padding: '20px 22px', borderRadius: 14, border: '1px solid var(--r-border)', background: 'var(--r-grad-card)', fontSize: 13, lineHeight: 1.75, color: 'var(--r-text-2)', fontFamily: 'inherit', whiteSpace: 'pre-wrap' }}>
        {viewMode === 'plain' ? <span>{displayBody}</span> : <BodyWithTokens body={template.body} />}
      </div>

      {viewMode === 'automation' && tokens.length > 0 && (
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

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4 }}>
        <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--r-text-3)' }}>
          <span>Created {fmtDate(template.createdAt)}</span>
          <span>Updated {fmtDate(template.updatedAt)}</span>
          <span>{template.body.split(/\s+/).length} words</span>
          <span>{tokens.length} placeholder{tokens.length !== 1 ? 's' : ''}</span>
        </div>
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
  );
}

// ── EditPanel ─────────────────────────────────────────────────────────────────

function EditPanel({
  mode, form, onChange, onSave, onCancel, saving, saveError,
}: {
  mode: TplMode;
  form: { name: string; category: TemplateCategory; body: string; notes: string; tags: string };
  onChange: (f: Partial<typeof form>) => void;
  onSave: () => void;
  onCancel: () => void;
  saving?: boolean;
  saveError?: string;
}) {
  const isValid = form.name.trim().length > 0 && form.body.trim().length > 0;
  const previewTokens = extractTokens(form.body);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ padding: '16px 20px', borderRadius: 14, border: '1px solid var(--r-border)', background: 'var(--r-grad-card)' }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--r-text)', marginBottom: 4, fontFamily: 'var(--r-font-serif)' }}>
          {mode === 'create' ? 'New Template' : 'Edit Template'}
        </div>
        <div style={{ fontSize: 12, color: 'var(--r-text-3)' }}>
          {mode === 'create' ? 'Create a new reusable message template.' : 'Make changes and save.'}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <input value={form.name} onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Template name…"
          style={{ flex: 2, padding: '9px 13px', borderRadius: 9, border: '1px solid var(--r-border)', background: 'var(--r-grad-card)', color: 'var(--r-text)', fontSize: 13, fontWeight: 600, outline: 'none' }}
        />
        <select value={form.category} onChange={(e) => onChange({ category: e.target.value as TemplateCategory })}
          style={{ flex: 1, padding: '9px 12px', borderRadius: 9, border: `1px solid ${CAT_META[form.category].border}`, background: CAT_META[form.category].bg, color: CAT_META[form.category].color, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
        >
          {CAT_ORDER.map((cat) => <option key={cat} value={cat}>{CAT_META[cat].label}</option>)}
        </select>
      </div>

      <input value={form.notes} onChange={(e) => onChange({ notes: e.target.value })}
        placeholder="Intended use / notes (optional)…"
        style={{ padding: '9px 13px', borderRadius: 9, border: '1px solid var(--r-border)', background: 'var(--r-grad-card)', color: 'var(--r-text-2)', fontSize: 12, outline: 'none' }}
      />

      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--r-text-3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Message body</span>
          {previewTokens.length > 0 && (
            <span style={{ fontSize: 10, color: 'var(--r-gold)' }}>{previewTokens.length} placeholder{previewTokens.length !== 1 ? 's' : ''} detected</span>
          )}
        </div>
        <textarea value={form.body} onChange={(e) => onChange({ body: e.target.value })}
          placeholder={`Write your template here...\n\nUse {{client_name}}, {{property_name}}, {{agent_name}}, etc. for placeholders.`}
          rows={14}
          style={{ width: '100%', padding: '13px 16px', borderRadius: 11, border: '1px solid var(--r-border)', background: 'var(--r-grad-card)', color: 'var(--r-text)', fontSize: 13, lineHeight: 1.7, fontFamily: 'inherit', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
        />
      </div>

      <div style={{ padding: '12px 16px', borderRadius: 10, border: '1px solid var(--r-border)', background: 'var(--r-gold-faint)' }}>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--r-gold)', marginBottom: 8 }}>Available placeholders</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {Object.keys(PLACEHOLDER_DOCS).map((token) => (
            <button key={token} onClick={() => onChange({ body: form.body + token })} title={PLACEHOLDER_DOCS[token].label}
              style={{ fontFamily: 'monospace', fontSize: 10, fontWeight: 700, color: 'var(--r-gold)', background: 'var(--r-gold-faint)', border: '1px solid var(--r-border)', borderRadius: 4, padding: '2px 7px', cursor: 'pointer' }}
            >
              {token}
            </button>
          ))}
        </div>
      </div>

      <input value={form.tags} onChange={(e) => onChange({ tags: e.target.value })}
        placeholder="Tags (comma-separated)…"
        style={{ padding: '9px 13px', borderRadius: 9, border: '1px solid var(--r-border)', background: 'var(--r-grad-card)', color: 'var(--r-text-2)', fontSize: 12, outline: 'none' }}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {saveError && (
          <div style={{ fontSize: 12, color: 'var(--r-danger)', background: 'var(--r-danger-bg)', border: '1px solid var(--r-danger-border)', borderRadius: 8, padding: '8px 12px' }}>
            {saveError}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onSave} disabled={!isValid || saving}
            className={isValid && !saving ? 'r-btn-gold' : ''}
            style={{
              padding: '10px 24px', borderRadius: 9, border: '1px solid var(--r-border)',
              background: isValid && !saving ? 'var(--r-gold-faint)' : 'var(--r-grad-card)',
              color: isValid && !saving ? 'var(--r-gold-bright)' : 'var(--r-text-3)',
              fontSize: 13, fontWeight: 700, cursor: isValid && !saving ? 'pointer' : 'default',
              opacity: isValid && !saving ? 1 : 0.5,
            }}
          >
            {saving ? 'Saving…' : mode === 'create' ? 'Create Template' : 'Save Changes'}
          </button>
          <button onClick={onCancel} disabled={saving} style={actionBtn}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── TemplatesSection ──────────────────────────────────────────────────────────

function TemplatesSection() {
  const { templates, createTemplate, updateTemplate, deleteTemplate, duplicateTemplate } = useTemplates();

  const [selectedId, setSelectedId] = useState<string | null>(templates[0]?.id ?? null);
  const [mode,       setMode]       = useState<TplMode>('view');
  const [search,     setSearch]     = useState('');
  const [catFilter,  setCatFilter]  = useState<TemplateCategory | 'all'>('all');
  const [sort,       setSort]       = useState<'recent' | 'name'>('name');
  const [copied,     setCopied]     = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [saveError,  setSaveError]  = useState('');
  const [toast,      setToast]      = useState<string | null>(null);
  const [form,       setForm]       = useState(EMPTY_FORM);

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

  async function handleSave() {
    if (!form.name.trim() || !form.body.trim()) return;
    setSaving(true); setSaveError('');
    try {
      const tags = form.tags.split(',').map((s) => s.trim()).filter(Boolean);
      if (mode === 'create') {
        await createTemplate({ name: form.name.trim(), category: form.category, body: form.body, tags, notes: form.notes || undefined });
      } else if (mode === 'edit' && selectedId) {
        await updateTemplate(selectedId, { name: form.name.trim(), category: form.category, body: form.body, tags, notes: form.notes || undefined });
      }
      setToast(mode === 'create' ? 'Template created' : 'Template saved');
      setTimeout(() => setToast(null), 3000);
      setMode('view');
    } catch (err: any) {
      setSaveError(err?.message ?? 'Save failed — please try again.');
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() { setMode('view'); setForm(EMPTY_FORM); setSaveError(''); }

  function handleDelete(id: string) {
    if (!confirmDel) { setConfirmDel(true); return; }
    deleteTemplate(id);
    setSelectedId(templates.find((t) => t.id !== id)?.id ?? null);
    setConfirmDel(false); setMode('view');
  }

  function handleCopy(body: string) {
    navigator.clipboard.writeText(body).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  }

  const jumpTo = useCallback((name: string) => {
    const t = templates.find((x) => x.name === name);
    if (t) { setSelectedId(t.id); setMode('view'); }
  }, [templates]);

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

  const byCategory = (cat: TemplateCategory) => templates.filter((t) => t.category === cat).length;
  const thirtyDaysAgo = useMemo(() => new Date(Date.now() - 30 * 86_400_000), []);
  const recentCount = templates.filter((t) => new Date(t.updatedAt) >= thirtyDaysAgo).length;

  return (
    <>
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
          padding: '10px 18px', borderRadius: 12,
          background: 'var(--r-success-bg)', border: '1px solid var(--r-success-border)',
          color: 'var(--r-success)', fontSize: 13, fontWeight: 600,
          boxShadow: '0 4px 24px rgba(0,0,0,0.4)', pointerEvents: 'none',
        }}>
          {toast}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button onClick={() => openCreate()} className="r-btn-gold" style={{
          padding: '9px 20px', borderRadius: 10, border: '1px solid var(--r-border)',
          background: 'var(--r-gold-faint)', color: 'var(--r-gold-bright)',
          fontSize: 13, fontWeight: 700, cursor: 'pointer',
        }}>
          + New Template
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 18 }}>
        <StatCard label="Total"     value={templates.length}        subtext="in library" />
        <StatCard label="Buyer"     value={byCategory('buyer')}     subtext="buyer-facing" />
        <StatCard label="Seller"    value={byCategory('seller')}    subtext="seller-facing" />
        <StatCard label="Follow-Up" value={byCategory('follow-up')} subtext="nurture & re-engage" />
        <StatCard label="Updated"   value={recentCount}             subtext="last 30 days" />
      </div>

      <div style={{ display: 'flex', gap: 7, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--r-text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', flexShrink: 0 }}>Quick access:</span>
        {USE_CASES.map(({ label, templateName }) => (
          <button key={label} onClick={() => jumpTo(templateName)} className="r-tab" style={{
            padding: '5px 12px', borderRadius: 7, border: '1px solid var(--r-border)',
            background: 'var(--r-grad-card)', color: 'var(--r-text-2)',
            fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
          }}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <div style={{ width: 340, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search templates…"
              style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--r-border)', background: 'var(--r-grad-card)', color: 'var(--r-text)', fontSize: 12, outline: 'none' }}
            />
            <select value={sort} onChange={(e) => setSort(e.target.value as 'recent' | 'name')}
              style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--r-border)', background: 'var(--r-grad-card)', color: 'var(--r-text-2)', fontSize: 12, cursor: 'pointer' }}
            >
              <option value="name">A–Z</option>
              <option value="recent">Recent</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {(['all', ...CAT_ORDER] as (TemplateCategory | 'all')[]).map((cat) => {
              const active = catFilter === cat;
              const cm = CAT_META[cat];
              return (
                <button key={cat} onClick={() => setCatFilter(cat)} className="r-tab" style={{
                  padding: '5px 11px', borderRadius: 7,
                  border: active ? `1px solid ${cm.border}` : '1px solid var(--r-border)',
                  background: active ? cm.bg : 'var(--r-grad-card)',
                  color: active ? cm.color : 'var(--r-text-3)',
                  fontSize: 11, fontWeight: active ? 700 : 500, cursor: 'pointer',
                }}>
                  {cm.label}
                </button>
              );
            })}
          </div>

          <div className="template-list-scroll" style={{ display: 'flex', flexDirection: 'column', gap: 5, overflowY: 'auto', maxHeight: 'calc(100vh - 340px)' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', fontSize: 12, color: 'var(--r-text-3)' }}>No templates match.</div>
            ) : filtered.map((t) => {
              const cm = CAT_META[t.category];
              const isSelected = selectedId === t.id;
              return (
                <button key={t.id} onClick={() => { setSelectedId(t.id); setMode('view'); setConfirmDel(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', textAlign: 'left',
                    padding: 0, minHeight: 44, flexShrink: 0,
                    borderRadius: 11,
                    border: isSelected ? '1px solid var(--r-border)' : `1px solid ${cm.border}`,
                    background: isSelected ? 'var(--r-gold-faint)' : cm.bg,
                    cursor: 'pointer', overflow: 'hidden', width: '100%',
                  }}
                >
                  <div style={{ width: 3, flexShrink: 0, alignSelf: 'stretch', background: cm.color }} />
                  <span style={{ flex: 1, minWidth: 0, padding: '0 12px', fontSize: 13, fontWeight: 700, color: 'var(--r-text)', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {mode === 'view' && selected ? (
            <ViewPanel
              template={selected} tokens={tokens} copied={copied} confirmDel={confirmDel}
              onCopy={handleCopy} onEdit={() => openEdit(selected.id)}
              onDuplicate={() => duplicateTemplate(selected.id)}
              onCreateFrom={() => openCreate(selected.id)}
              onDelete={() => handleDelete(selected.id)} onCancelDel={() => setConfirmDel(false)}
            />
          ) : mode === 'view' && !selected ? (
            <div style={{ padding: '60px 24px', textAlign: 'center', borderRadius: 16, border: '1px solid var(--r-border)', background: 'var(--r-grad-card)', color: 'var(--r-text-3)', fontSize: 13 }}>
              Select a template from the library.
            </div>
          ) : (
            <EditPanel mode={mode} form={form} onChange={(f) => setForm((prev) => ({ ...prev, ...f }))}
              onSave={handleSave} onCancel={handleCancel} saving={saving} saveError={saveError} />
          )}
        </div>
      </div>
    </>
  );
}

// ── CampaignsSection ──────────────────────────────────────────────────────────

function CampaignsSection({
  isBroker,
  subscribers,
  subsLoading,
  templates,
}: {
  isBroker:    boolean;
  subscribers: NewsletterContact[];
  subsLoading: boolean;
  templates:   TemplateRecord[];
}) {
  const [step,         setStep]         = useState<CampStep>(1);
  const [campTag,      setCampTag]      = useState<string | null>(null);
  const [source,       setSource]       = useState<'scratch' | 'template'>('scratch');
  const [templateId,   setTemplateId]   = useState<string | null>(null);
  const [subject,      setSubject]      = useState('');
  const [body,         setBody]         = useState('');
  const [imageUrl,     setImageUrl]     = useState('');
  const [sending,      setSending]      = useState(false);
  const [result,       setResult]       = useState<{ sent: number; failed: number; total: number } | null>(null);
  const [campError,    setCampError]    = useState('');
  const [tplSearch,    setTplSearch]    = useState('');

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const s of subscribers) for (const t of s.newsletterTags) set.add(t);
    return [...set].sort();
  }, [subscribers]);

  const recipients = useMemo(() => {
    const base = subscribers.filter((s) => s.email);
    if (!campTag) return base;
    return base.filter((s) => s.newsletterTags.some((t) => t.toLowerCase() === campTag.toLowerCase()));
  }, [subscribers, campTag]);

  const filteredTemplates = useMemo(() => {
    if (!tplSearch.trim()) return templates;
    const q = tplSearch.toLowerCase();
    return templates.filter((t) => t.name.toLowerCase().includes(q));
  }, [templates, tplSearch]);

  const selectedTemplate = templates.find((t) => t.id === templateId) ?? null;
  const hasTokens = /{{[^}]+}}/.test(body);

  function reset() {
    setStep(1); setCampTag(null); setSource('scratch'); setTemplateId(null);
    setSubject(''); setBody(''); setImageUrl('');
    setResult(null); setCampError(''); setTplSearch('');
  }

  function pickTemplate(t: TemplateRecord) {
    setTemplateId(t.id);
    setBody(t.body);
  }

  async function handleSend() {
    if (!subject.trim() || !body.trim()) { setCampError('Subject and body are required.'); return; }
    setSending(true); setCampError('');
    try {
      let finalBody = body.trim();
      const imgUrl = imageUrl.trim();
      if (imgUrl) {
        finalBody += `\n\n<img src="${imgUrl}" alt="" style="max-width:100%;height:auto;display:block;" />`;
      }

      const contactIds = recipients.filter((r) => r.kind === 'contact').map((r) => r.id);
      const leadIds    = recipients.filter((r) => r.kind === 'lead').map((r) => r.id);

      const res = await fetch('/api/messages/email/bulk', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          subject:      subject.trim(),
          body:         finalBody,
          recipientIds: [...contactIds, ...leadIds],
          kind:         'both',
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to send campaign');
      setResult({ sent: json.sent, failed: json.failed, total: json.total });
    } catch (err: any) {
      setCampError(err?.message ?? 'Failed to send campaign.');
    } finally {
      setSending(false);
    }
  }

  if (!isBroker) {
    return (
      <div style={{ borderRadius: 16, border: '1px solid var(--r-border)', padding: '48px 24px', textAlign: 'center', color: 'var(--r-text-3)' }}>
        <div style={{ fontSize: 20, marginBottom: 10 }}>✉</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--r-text-2)', marginBottom: 6 }}>Broker access required</div>
        <div style={{ fontSize: 12 }}>Only brokers can send bulk newsletter campaigns.</div>
      </div>
    );
  }

  if (result) {
    return (
      <div style={{ maxWidth: 520 }}>
        <div style={{ padding: '24px', borderRadius: 16, border: '1px solid var(--r-success-border)', background: 'var(--r-success-bg)' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--r-success)', marginBottom: 8, fontFamily: 'var(--r-font-serif)' }}>
            Campaign sent
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 18 }}>
            {[['Total', result.total], ['Delivered', result.sent], ['Failed', result.failed]].map(([label, val]) => (
              <div key={label as string} style={{ padding: '12px', borderRadius: 10, background: 'rgba(0,0,0,0.1)', textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--r-success)' }}>{val}</div>
                <div style={{ fontSize: 11, color: 'var(--r-success)', opacity: 0.8, fontWeight: 600 }}>{label}</div>
              </div>
            ))}
          </div>
          <button onClick={reset} style={{
            padding: '8px 20px', borderRadius: 9, fontSize: 12, fontWeight: 700,
            border: '1px solid var(--r-success-border)', background: 'transparent',
            color: 'var(--r-success)', cursor: 'pointer',
          }}>
            Send another campaign
          </button>
        </div>
      </div>
    );
  }

  // Step indicator
  const STEP_LABELS = ['Audience', 'Content', 'Compose', 'Confirm'];

  return (
    <div style={{ maxWidth: 640 }}>
      {/* Step indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 28 }}>
        {STEP_LABELS.map((label, i) => {
          const s = (i + 1) as CampStep;
          const active = step === s;
          const done   = step > s;
          return (
            <div key={s} style={{ display: 'flex', alignItems: 'center', flex: i < 3 ? 1 : undefined }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 60 }}>
                <div style={{
                  width: 26, height: 26, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700,
                  background: done ? 'var(--r-gold-faint)' : active ? 'var(--r-gold-faint)' : 'transparent',
                  border: done || active ? '1px solid var(--r-border)' : '1px solid rgba(200,164,92,0.15)',
                  color: done || active ? 'var(--r-gold-bright)' : 'var(--r-text-3)',
                }}>
                  {done ? '✓' : s}
                </div>
                <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: active ? 'var(--r-gold-bright)' : done ? 'var(--r-text-2)' : 'var(--r-text-3)', whiteSpace: 'nowrap' }}>
                  {label}
                </span>
              </div>
              {i < 3 && <div style={{ flex: 1, height: 1, background: done ? 'var(--r-border)' : 'rgba(200,164,92,0.12)', marginBottom: 20 }} />}
            </div>
          );
        })}
      </div>

      {/* Step 1: Audience */}
      {step === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--r-text)', fontFamily: 'var(--r-font-serif)' }}>Select Audience</div>

          {subsLoading ? (
            <div style={{ fontSize: 13, color: 'var(--r-text-3)', padding: '16px 0' }}>Loading subscribers…</div>
          ) : (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                <button
                  onClick={() => setCampTag(null)}
                  style={{
                    padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: campTag === null ? 700 : 500, cursor: 'pointer',
                    border: '1px solid var(--r-border)',
                    background: campTag === null ? 'var(--r-gold-faint)' : 'transparent',
                    color: campTag === null ? 'var(--r-gold-bright)' : 'var(--r-text-3)',
                  }}
                >
                  All subscribers ({subscribers.filter((s) => s.email).length})
                </button>
                {allTags.map((tag) => {
                  const count = subscribers.filter((s) => s.email && s.newsletterTags.some((t) => t.toLowerCase() === tag.toLowerCase())).length;
                  const active = campTag?.toLowerCase() === tag.toLowerCase();
                  return (
                    <button key={tag} onClick={() => setCampTag(active ? null : tag)}
                      style={{
                        padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: active ? 700 : 500, cursor: 'pointer',
                        border: '1px solid var(--r-border)',
                        background: active ? 'var(--r-gold-faint)' : 'transparent',
                        color: active ? 'var(--r-gold-bright)' : 'var(--r-text-3)',
                      }}
                    >
                      {tag} ({count})
                    </button>
                  );
                })}
              </div>

              <div style={{ padding: '12px 16px', borderRadius: 10, border: '1px solid var(--r-border)', background: 'var(--r-grad-card)', fontSize: 13 }}>
                <span style={{ fontWeight: 700, color: 'var(--r-text)' }}>{recipients.length}</span>
                <span style={{ color: 'var(--r-text-3)' }}> opted-in subscriber{recipients.length !== 1 ? 's' : ''} will receive this campaign.</span>
              </div>

              {subscribers.length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--r-text-3)', fontStyle: 'italic' }}>
                  No newsletter subscribers yet. Enable newsletter opt-in on contacts to add them.
                </div>
              )}
            </>
          )}

          <div>
            <button
              onClick={() => { setCampError(''); setStep(2); }}
              disabled={recipients.length === 0}
              style={{
                padding: '10px 24px', borderRadius: 9, fontSize: 13, fontWeight: 700,
                border: '1px solid var(--r-border)',
                background: recipients.length > 0 ? 'var(--r-gold-faint)' : 'var(--r-grad-card)',
                color: recipients.length > 0 ? 'var(--r-gold-bright)' : 'var(--r-text-3)',
                cursor: recipients.length > 0 ? 'pointer' : 'default',
                opacity: recipients.length > 0 ? 1 : 0.5,
              }}
            >
              Next: Choose Content →
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Content source */}
      {step === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--r-text)', fontFamily: 'var(--r-font-serif)' }}>Choose Content</div>

          <div style={{ display: 'flex', gap: 10 }}>
            {(['scratch', 'template'] as const).map((s) => (
              <button key={s} onClick={() => { setSource(s); if (s === 'scratch') { setTemplateId(null); setBody(''); } }}
                style={{
                  flex: 1, padding: '14px 16px', borderRadius: 11, cursor: 'pointer', textAlign: 'left',
                  border: source === s ? '1px solid var(--r-gold)' : '1px solid var(--r-border)',
                  background: source === s ? 'var(--r-gold-faint)' : 'var(--r-grad-card)',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: source === s ? 'var(--r-gold-bright)' : 'var(--r-text)', marginBottom: 3 }}>
                  {s === 'scratch' ? 'Start from scratch' : 'Use a template'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--r-text-3)' }}>
                  {s === 'scratch' ? 'Write a fresh subject and body.' : 'Pick from your template library.'}
                </div>
              </button>
            ))}
          </div>

          {source === 'template' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input value={tplSearch} onChange={(e) => setTplSearch(e.target.value)}
                placeholder="Search templates…"
                style={{ ...inputStyle }}
              />
              <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 5 }}>
                {filteredTemplates.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--r-text-3)', padding: '12px', textAlign: 'center' }}>No templates found.</div>
                ) : filteredTemplates.map((t) => {
                  const cm = CAT_META[t.category];
                  const isSelected = templateId === t.id;
                  return (
                    <button key={t.id} onClick={() => pickTemplate(t)}
                      style={{
                        display: 'flex', alignItems: 'center', textAlign: 'left',
                        padding: 0, minHeight: 42, borderRadius: 9, cursor: 'pointer',
                        border: isSelected ? '1px solid var(--r-gold)' : `1px solid ${cm.border}`,
                        background: isSelected ? 'var(--r-gold-faint)' : cm.bg,
                        width: '100%', overflow: 'hidden',
                      }}
                    >
                      <div style={{ width: 3, flexShrink: 0, alignSelf: 'stretch', background: cm.color }} />
                      <span style={{ padding: '0 10px', fontSize: 12, fontWeight: 700, color: 'var(--r-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                        {t.name}
                      </span>
                      <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: cm.color, padding: '0 10px 0 0', flexShrink: 0 }}>
                        {cm.label}
                      </span>
                    </button>
                  );
                })}
              </div>
              {selectedTemplate && (
                <div style={{ fontSize: 11, color: 'var(--r-gold-bright)', fontWeight: 600 }}>
                  Selected: {selectedTemplate.name}
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setStep(1)} style={actionBtn}>← Back</button>
            <button
              onClick={() => { setCampError(''); setStep(3); }}
              disabled={source === 'template' && !templateId}
              style={{
                padding: '10px 24px', borderRadius: 9, fontSize: 13, fontWeight: 700,
                border: '1px solid var(--r-border)',
                background: (source === 'scratch' || templateId) ? 'var(--r-gold-faint)' : 'var(--r-grad-card)',
                color: (source === 'scratch' || templateId) ? 'var(--r-gold-bright)' : 'var(--r-text-3)',
                cursor: (source === 'scratch' || templateId) ? 'pointer' : 'default',
                opacity: (source === 'scratch' || templateId) ? 1 : 0.5,
              }}
            >
              Next: Compose →
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Compose */}
      {step === 3 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--r-text)', fontFamily: 'var(--r-font-serif)' }}>Compose</div>

          <div>
            <label style={labelStyle}>Subject *</label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject line…"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Message body *</label>
            <textarea value={body} onChange={(e) => setBody(e.target.value)}
              placeholder="Write your message…"
              rows={10}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.65 }}
            />
          </div>

          {hasTokens && (
            <div style={{ padding: '10px 14px', borderRadius: 9, border: '1px solid rgba(200,164,92,0.3)', background: 'rgba(200,164,92,0.06)', fontSize: 12, color: 'var(--r-gold)' }}>
              ⚠ This message contains {'{{tokens}}'} that won't be substituted in bulk sends. Replace them with actual values before sending.
            </div>
          )}

          <div>
            <label style={labelStyle}>Image URL (optional)</label>
            <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://… — appended as an image at the bottom of the email"
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setStep(2)} style={actionBtn}>← Back</button>
            <button
              onClick={() => {
                if (!subject.trim()) { setCampError('Subject is required.'); return; }
                if (!body.trim()) { setCampError('Body is required.'); return; }
                setCampError(''); setStep(4);
              }}
              style={{
                padding: '10px 24px', borderRadius: 9, fontSize: 13, fontWeight: 700,
                border: '1px solid var(--r-border)', background: 'var(--r-gold-faint)',
                color: 'var(--r-gold-bright)', cursor: 'pointer',
              }}
            >
              Review →
            </button>
          </div>

          {campError && <div style={{ fontSize: 12, color: 'var(--r-danger)' }}>{campError}</div>}
        </div>
      )}

      {/* Step 4: Confirm & Send */}
      {step === 4 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--r-text)', fontFamily: 'var(--r-font-serif)' }}>Confirm & Send</div>

          <div style={{ padding: '18px 20px', borderRadius: 14, border: '1px solid var(--r-border)', background: 'var(--r-grad-card)', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--r-text-3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Recipients</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--r-text)' }}>
                {recipients.length} subscriber{recipients.length !== 1 ? 's' : ''}
                {campTag && <span style={{ fontWeight: 500, color: 'var(--r-text-3)', fontSize: 12 }}> — {campTag}</span>}
              </span>
            </div>
            <div style={{ height: 1, background: 'var(--r-border)' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--r-text-3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Subject</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--r-text)' }}>{subject}</span>
            </div>
            {imageUrl.trim() && (
              <>
                <div style={{ height: 1, background: 'var(--r-border)' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--r-text-3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Image</span>
                  <span style={{ fontSize: 11, color: 'var(--r-text-3)', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{imageUrl}</span>
                </div>
              </>
            )}
          </div>

          <div style={{ padding: '12px 16px', borderRadius: 10, border: '1px solid rgba(200,164,92,0.2)', background: 'rgba(200,164,92,0.04)', fontSize: 12, color: 'var(--r-text-3)' }}>
            This will send <strong style={{ color: 'var(--r-text)' }}>{recipients.length}</strong> email{recipients.length !== 1 ? 's' : ''}. This cannot be undone.
          </div>

          {campError && (
            <div style={{ fontSize: 12, color: 'var(--r-danger)', background: 'var(--r-danger-bg)', border: '1px solid var(--r-danger-border)', borderRadius: 8, padding: '8px 12px' }}>
              {campError}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setStep(3)} disabled={sending} style={actionBtn}>← Back</button>
            <button
              onClick={handleSend}
              disabled={sending || recipients.length === 0}
              style={{
                padding: '10px 24px', borderRadius: 9, fontSize: 13, fontWeight: 700,
                border: '1px solid var(--r-border)', background: 'var(--r-gold-faint)',
                color: 'var(--r-gold-bright)', cursor: sending ? 'default' : 'pointer',
                opacity: sending ? 0.6 : 1,
              }}
            >
              {sending ? `Sending ${recipients.length} emails…` : `Send to ${recipients.length} subscriber${recipients.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── AudienceSection ───────────────────────────────────────────────────────────

function AudienceSection({
  subscribers,
  loading,
  isBroker,
}: {
  subscribers: NewsletterContact[];
  loading:     boolean;
  isBroker:    boolean;
}) {
  const agents      = useAppStore((s) => s.agents);
  const [search,     setSearch]     = useState('');
  const [filterKind, setFilterKind] = useState<'all' | 'contact' | 'lead'>('all');

  const filtered = useMemo(() => {
    let list = subscribers;
    if (filterKind !== 'all') list = list.filter((s) => s.kind === filterKind);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (s) => s.fullName.toLowerCase().includes(q) ||
               s.email.toLowerCase().includes(q) ||
               s.newsletterTags.some((t) => t.toLowerCase().includes(q))
      );
    }
    return list;
  }, [subscribers, search, filterKind]);

  const contacts  = subscribers.filter((s) => s.kind === 'contact').length;
  const leads     = subscribers.filter((s) => s.kind === 'lead').length;
  const withEmail = subscribers.filter((s) => s.email).length;

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 22 }}>
        <StatCard label="Total Subscribers" value={subscribers.length} subtext="newsletter opt-in" />
        <StatCard label="Contacts"          value={contacts}           subtext="opted in" />
        <StatCard label="Leads"             value={leads}              subtext="opted in" />
        <StatCard label="With Email"        value={withEmail}          subtext="reachable" />
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 18, alignItems: 'center', flexWrap: 'wrap' }}>
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, or tag…"
          style={{ flex: 1, minWidth: 200, padding: '8px 13px', borderRadius: 9, border: '1px solid var(--r-border)', background: 'rgba(200,164,92,0.04)', color: 'var(--r-text)', fontSize: 12, outline: 'none' }}
        />
        {(['all', 'contact', 'lead'] as const).map((k) => (
          <button key={k} onClick={() => setFilterKind(k)} style={{
            padding: '7px 14px', borderRadius: 8, fontSize: 11, fontWeight: filterKind === k ? 700 : 500,
            border: '1px solid var(--r-border)', cursor: 'pointer',
            background: filterKind === k ? 'var(--r-gold-faint)' : 'var(--r-grad-card)',
            color: filterKind === k ? 'var(--r-gold-bright)' : 'var(--r-text-3)',
          }}>
            {k === 'all' ? 'All' : k === 'contact' ? 'Contacts' : 'Leads'}
          </button>
        ))}
      </div>

      <div style={{ borderRadius: 16, border: '1px solid var(--r-border)', overflow: 'hidden', background: 'var(--r-grad-card)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr auto', padding: '10px 18px', borderBottom: '1px solid var(--r-border)', background: 'rgba(200,164,92,0.03)' }}>
          {['Name', 'Email', 'Type', 'Tags', 'Agent'].map((h) => (
            <span key={h} style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--r-text-3)' }}>{h}</span>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--r-text-3)', fontSize: 13 }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--r-text-3)', fontSize: 13 }}>
            {subscribers.length === 0
              ? 'No newsletter subscribers yet. Enable newsletter opt-in on contacts to add them.'
              : 'No subscribers match this filter.'}
          </div>
        ) : (
          filtered.map((sub, i) => {
            const agent = agents.find((a) => a.id === sub.assignedMemberId);
            return (
              <div key={sub.id} style={{
                display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr auto',
                padding: '12px 18px', alignItems: 'center', gap: 8,
                borderTop: i === 0 ? 'none' : '1px solid var(--r-border)',
                background: i % 2 === 0 ? 'transparent' : 'rgba(200,164,92,0.015)',
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--r-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {sub.fullName || '—'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--r-text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {sub.email || <span style={{ color: 'var(--r-text-3)', fontStyle: 'italic' }}>No email</span>}
                </div>
                <span style={{
                  fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em',
                  color: sub.kind === 'lead' ? 'var(--r-gold-bright)' : '#7ca4cc',
                  background: sub.kind === 'lead' ? 'var(--r-gold-faint)' : 'rgba(124,164,204,0.1)',
                  border: '1px solid var(--r-border)', borderRadius: 4, padding: '2px 7px',
                  whiteSpace: 'nowrap', display: 'inline-block',
                }}>
                  {sub.kind}
                </span>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {sub.newsletterTags.length > 0
                    ? sub.newsletterTags.map((t) => <TagChip key={t} tag={t} />)
                    : <span style={{ fontSize: 11, color: 'var(--r-text-3)', fontStyle: 'italic' }}>—</span>
                  }
                </div>
                <span style={{ fontSize: 11, color: 'var(--r-text-3)', whiteSpace: 'nowrap' }}>
                  {agent ? agent.name.split(' ')[0] : <span style={{ fontStyle: 'italic' }}>—</span>}
                </span>
              </div>
            );
          })
        )}
      </div>

      {!loading && filtered.length > 0 && (
        <div style={{ marginTop: 12, fontSize: 11, color: 'var(--r-text-3)', textAlign: 'right' }}>
          {filtered.length} subscriber{filtered.length !== 1 ? 's' : ''} shown
          {!isBroker && ' · Showing only your assigned contacts'}
        </div>
      )}
    </>
  );
}

// ── HistorySection ────────────────────────────────────────────────────────────

function HistorySection({ isActive }: { isActive: boolean }) {
  const [logs,    setLogs]    = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded,  setLoaded]  = useState(false);
  const [error,   setError]   = useState('');

  useEffect(() => {
    if (!isActive || loaded) return;
    setLoading(true);
    fetch('/api/email-logs')
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); } else { setLogs(Array.isArray(d) ? d : []); }
        setLoaded(true);
      })
      .catch(() => setError('Failed to load history.'))
      .finally(() => setLoading(false));
  }, [isActive, loaded]);

  if (loading) {
    return <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--r-text-3)', fontSize: 13 }}>Loading history…</div>;
  }

  if (error) {
    return (
      <div style={{ padding: '14px 16px', borderRadius: 10, border: '1px solid var(--r-danger-border)', background: 'var(--r-danger-bg)', color: 'var(--r-danger)', fontSize: 12 }}>
        {error}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div style={{ borderRadius: 16, border: '1px dashed var(--r-border)', padding: '48px 24px', textAlign: 'center', color: 'var(--r-text-3)' }}>
        <div style={{ fontSize: 20, marginBottom: 10 }}>✉</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--r-text-2)', marginBottom: 6 }}>No email history yet</div>
        <div style={{ fontSize: 12 }}>Sent emails will appear here.</div>
      </div>
    );
  }

  return (
    <div style={{ borderRadius: 16, border: '1px solid var(--r-border)', overflow: 'hidden', background: 'var(--r-grad-card)' }}>
      <div style={{
        display: 'grid', gridTemplateColumns: '1.5fr 2fr 1fr 90px 80px',
        padding: '10px 18px', borderBottom: '1px solid var(--r-border)',
        background: 'rgba(200,164,92,0.03)',
      }}>
        {['Date', 'Subject', 'Recipient', 'Provider', 'Status'].map((h) => (
          <span key={h} style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--r-text-3)' }}>{h}</span>
        ))}
      </div>

      {logs.map((log, i) => (
        <div key={log.id} style={{
          display: 'grid', gridTemplateColumns: '1.5fr 2fr 1fr 90px 80px',
          padding: '11px 18px', alignItems: 'center', gap: 8,
          borderTop: i === 0 ? 'none' : '1px solid var(--r-border)',
          background: i % 2 === 0 ? 'transparent' : 'rgba(200,164,92,0.015)',
        }}>
          <span style={{ fontSize: 11, color: 'var(--r-text-3)', whiteSpace: 'nowrap' }}>
            {fmtDateTime(log.created_at)}
          </span>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--r-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.subject}>
            {log.subject}
          </span>
          <span style={{ fontSize: 11, color: 'var(--r-text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {log.to_email}
          </span>
          <span style={{ fontSize: 10, color: 'var(--r-text-3)', textTransform: 'capitalize' }}>
            {log.provider}
          </span>
          <span style={{
            fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em',
            color: log.status === 'sent' ? 'var(--r-success)' : 'var(--r-danger)',
            background: log.status === 'sent' ? 'var(--r-success-bg)' : 'var(--r-danger-bg)',
            border: `1px solid ${log.status === 'sent' ? 'var(--r-success-border)' : 'var(--r-danger-border)'}`,
            borderRadius: 4, padding: '2px 6px', whiteSpace: 'nowrap', display: 'inline-block',
          }}>
            {log.status}
          </span>
        </div>
      ))}

      <div style={{ padding: '10px 18px', borderTop: '1px solid var(--r-border)', fontSize: 11, color: 'var(--r-text-3)', textAlign: 'right' }}>
        {logs.length} most recent send{logs.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type Tab = 'templates' | 'campaigns' | 'audience' | 'history';

export default function MessagingPage() {
  useAgents();
  const { templates } = useTemplates();
  const currentRole = useAppStore((s) => s.currentRole);
  const isBroker    = currentRole === 'broker';

  const [tab,         setTab]         = useState<Tab>('templates');
  const [subscribers, setSubscribers] = useState<NewsletterContact[]>([]);
  const [subsLoading, setSubsLoading] = useState(false);

  useEffect(() => {
    setSubsLoading(true);
    fetch('/api/newsletter', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setSubscribers(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setSubsLoading(false));
  }, []);

  const TABS: { key: Tab; label: string }[] = [
    { key: 'templates', label: 'Templates' },
    { key: 'campaigns', label: 'Campaigns' },
    { key: 'audience',  label: 'Audience'  },
    { key: 'history',   label: 'History'   },
  ];

  return (
    <AppShell>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 34, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--r-text)', lineHeight: 1.05, fontFamily: 'var(--r-font-serif)' }}>
          Messaging
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--r-text-3)' }}>
          Templates, campaigns, audience, and send history in one place.
        </p>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 24, borderBottom: '1px solid var(--r-border)', paddingBottom: 0 }}>
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className="r-tab"
            style={{
              padding: '9px 18px', borderRadius: '9px 9px 0 0', fontSize: 12,
              fontWeight: tab === key ? 700 : 500,
              border: tab === key ? '1px solid var(--r-border)' : '1px solid transparent',
              borderBottom: tab === key ? '1px solid var(--r-bg)' : '1px solid transparent',
              background: tab === key ? 'var(--r-gold-faint)' : 'transparent',
              color: tab === key ? 'var(--r-gold-bright)' : 'var(--r-text-2)',
              cursor: 'pointer',
              position: 'relative',
              top: 1,
            }}
          >
            {label}
            {key === 'campaigns' && !isBroker && (
              <span style={{ marginLeft: 5, fontSize: 9, opacity: 0.6, fontWeight: 600 }}>broker</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'templates' && <TemplatesSection />}
      {tab === 'campaigns' && (
        <CampaignsSection
          isBroker={isBroker}
          subscribers={subscribers}
          subsLoading={subsLoading}
          templates={templates}
        />
      )}
      {tab === 'audience' && (
        <AudienceSection
          subscribers={subscribers}
          loading={subsLoading}
          isBroker={isBroker}
        />
      )}
      {tab === 'history' && <HistorySection isActive={tab === 'history'} />}
    </AppShell>
  );
}
