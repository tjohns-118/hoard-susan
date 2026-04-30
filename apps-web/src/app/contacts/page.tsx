'use client';

export const dynamic = 'force-dynamic';

import { useMemo, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { StatCard } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import { useAppStore } from '@/app/store/useAppStore';
import { useContacts } from '@/hooks/useContacts';
import { useAgents } from '@/hooks/useAgents';
import { useOpportunities } from '@/hooks/useOpportunities';
import { useTasks } from '@/hooks/useTasks';
import type { Contact, ContactRole, BuyerProfile, SellerProfile } from '@/features/contacts/types';
import {
  EMPTY_BUYER, EMPTY_SELLER, PROP_TYPE_LABELS, CONDITION_LABELS,
  fmtPrice, inputStyle, selectStyle,
  FieldLabel, TagPills, RoleBadge, ProfileSummary, ProfilePanel,
  ProfileFormSection,
} from '@/components/crm/ProfileUi';

// ── Constants ─────────────────────────────────────────────────────────────────

const REF = new Date(); // current date — drives staleness and recency calculations

type FilterKey = 'all' | 'buyers' | 'sellers' | 'investors' | 'active' | 'hot' | 'archived';
type Health = 'hot' | 'stale' | 'needs-followup' | 'recently-updated' | 'normal';

const FILTER_TABS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'buyers', label: 'Buyers' },
  { key: 'sellers', label: 'Sellers' },
  { key: 'investors', label: 'Investors' },
  { key: 'active', label: 'Active Clients' },
  { key: 'hot', label: 'Hot' },
  { key: 'archived', label: 'Archived' },
];

const STATUS_TONE = {
  active: 'success',
  lead: 'warning',
  closed: 'default',
} as const;

const NEXT_ACTION: Record<Health, string> = {
  hot: 'Priority contact — reach out today and keep momentum going.',
  stale: 'Re-engage with a check-in call or relevant listing update.',
  'needs-followup': 'Schedule a follow-up call or send a property update.',
  'recently-updated': 'Good cadence — stay connected with next steps.',
  normal: 'Maintain regular touchpoints and monitor for activity signals.',
};

// Earthy stage colors
const STAGE_COLOR: Record<string, string> = {
  prospect: '#7ca4cc', qualified: '#9b8ab4', proposal: '#e2c47c',
  negotiation: '#c8823c', won: '#7dba82', lost: '#b06060',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysSince(iso: string) {
  return Math.floor((REF.getTime() - new Date(iso).getTime()) / 86_400_000);
}

function fmtValue(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  return `$${(v / 1_000).toFixed(0)}k`;
}

function getHealth(c: Contact): Health {
  if (c.tags.includes('hot')) return 'hot';
  if (c.status === 'closed') return 'normal';
  const age = daysSince(c.lastActivityAt);
  if (age > 14) return 'stale';
  if (age > 6) return 'needs-followup';
  if (age <= 2) return 'recently-updated';
  return 'normal';
}

// ── Micro-components ──────────────────────────────────────────────────────────

function HealthChip({ health }: { health: Health }) {
  if (health === 'normal') return null;
  const map = {
    hot: { label: 'HOT', bg: 'var(--r-warning-bg)', border: 'var(--r-warning-border)', color: 'var(--r-warning)' },
    stale: { label: 'Stale', bg: 'var(--r-danger-bg)', border: 'var(--r-danger-border)', color: 'var(--r-danger)' },
    'needs-followup': { label: 'Needs Follow-Up', bg: 'var(--r-warning-bg)', border: 'var(--r-warning-border)', color: 'var(--r-gold-bright)' },
    'recently-updated': { label: 'Recent', bg: 'var(--r-success-bg)', border: 'var(--r-success-border)', color: 'var(--r-success)' },
  } as const;
  const s = map[health];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 800, background: s.bg, border: `1px solid ${s.border}`, color: s.color, letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  );
}

function Panel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div className="r-card" style={{ borderRadius: 16, background: 'var(--r-grad-card)', border: '1px solid var(--r-border)', boxShadow: 'var(--r-shadow)', padding: '16px 18px', ...style }}>
      {children}
    </div>
  );
}

function SubHeader({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--r-text-3)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 10 }}>
      {children}
    </div>
  );
}

function ActionBtn({ children, onClick, tone = 'default', disabled }: { children: React.ReactNode; onClick?: () => void; tone?: 'default' | 'hot' | 'success' | 'danger' | 'primary'; disabled?: boolean }) {
  const styles = {
    default: { bg: 'rgba(200,164,92,0.06)', border: 'rgba(200,164,92,0.16)', color: 'var(--r-text-2)' },
    hot: { bg: 'var(--r-warning-bg)', border: 'var(--r-warning-border)', color: 'var(--r-warning)' },
    success: { bg: 'var(--r-success-bg)', border: 'var(--r-success-border)', color: 'var(--r-success)' },
    danger: { bg: 'var(--r-danger-bg)', border: 'var(--r-danger-border)', color: 'var(--r-danger)' },
    primary: { bg: 'var(--r-gold-faint)', border: 'var(--r-border)', color: 'var(--r-gold)' },
  }[tone];
  return (
    <button onClick={onClick} disabled={disabled} style={{ padding: '5px 11px', borderRadius: 8, border: `1px solid ${styles.border}`, background: styles.bg, color: styles.color, fontSize: 11, fontWeight: 700, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.4 : 1, letterSpacing: '0.01em', whiteSpace: 'nowrap' }}>
      {children}
    </button>
  );
}

// ── Newsletter tag input ──────────────────────────────────────────────────────

const NL_TAG_PRESETS = ['Buyers', 'Sellers', 'Investors', 'Luxury', 'Waterfront', 'Past Clients', 'Open House', 'General'];

function NewsletterTagInput({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const [customInput, setCustomInput] = useState('');

  function togglePreset(preset: string) {
    const lower = preset.toLowerCase();
    const already = tags.some((t) => t.toLowerCase() === lower);
    onChange(already ? tags.filter((t) => t.toLowerCase() !== lower) : [...tags, preset]);
  }

  function addCustom() {
    const val = customInput.trim();
    if (!val) return;
    const lower = val.toLowerCase();
    if (!tags.some((t) => t.toLowerCase() === lower)) onChange([...tags, val]);
    setCustomInput('');
  }

  function removeTag(tag: string) {
    onChange(tags.filter((t) => t !== tag));
  }

  return (
    <div style={{ marginBottom: 10, padding: '8px 10px', borderRadius: 9, background: 'rgba(200,164,92,0.04)', border: '1px solid var(--r-border)' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--r-text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Groups</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 7 }}>
        {NL_TAG_PRESETS.map((preset) => {
          const active = tags.some((t) => t.toLowerCase() === preset.toLowerCase());
          return (
            <button
              key={preset}
              type="button"
              onClick={() => togglePreset(preset)}
              style={{
                padding: '3px 9px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                background: active ? 'var(--r-gold-faint)' : 'transparent',
                border: `1px solid ${active ? 'var(--r-border)' : 'rgba(200,164,92,0.18)'}`,
                color: active ? 'var(--r-gold-bright)' : 'var(--r-text-3)',
              }}
            >
              {active ? '✓ ' : ''}{preset}
            </button>
          );
        })}
      </div>
      {tags.filter((t) => !NL_TAG_PRESETS.some((p) => p.toLowerCase() === t.toLowerCase())).length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 7 }}>
          {tags.filter((t) => !NL_TAG_PRESETS.some((p) => p.toLowerCase() === t.toLowerCase())).map((tag) => (
            <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 7px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: 'var(--r-gold-faint)', border: '1px solid var(--r-border)', color: 'var(--r-gold-bright)' }}>
              {tag}
              <button type="button" onClick={() => removeTag(tag)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--r-text-3)', fontSize: 10, padding: 0, lineHeight: 1 }}>✕</button>
            </span>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }}
          placeholder="Custom group…"
          style={{ flex: 1, fontSize: 11, padding: '4px 8px', borderRadius: 7, border: '1px solid var(--r-border)', background: 'var(--r-bg)', color: 'var(--r-text)', outline: 'none' }}
        />
        <button type="button" onClick={addCustom} style={{ fontSize: 11, padding: '4px 9px', borderRadius: 7, border: '1px solid var(--r-border)', background: 'var(--r-gold-faint)', color: 'var(--r-gold)', cursor: 'pointer', fontWeight: 700 }}>Add</button>
      </div>
    </div>
  );
}

// ── Contact Row ───────────────────────────────────────────────────────────────

function ContactRow({
  contact,
  agents,
  selected,
  onClick,
  onMarkHot,
  onAddTask,
}: {
  contact: Contact;
  agents: { id: string; name: string }[];
  selected: boolean;
  onClick: () => void;
  onMarkHot: (id: string) => void;
  onAddTask: (id: string) => void;
}) {
  const health = getHealth(contact);
  const isHot = contact.tags.includes('hot');
  const agent = agents.find((a) => a.id === contact.assignedAgentId);
  const age = daysSince(contact.lastActivityAt);

  return (
    <div
      onClick={onClick}
      className="r-row"
      style={{
        borderRadius: 13,
        background: selected ? 'rgba(200,164,92,0.08)' : 'var(--r-grad-card)',
        border: '1px solid var(--r-border)',
        padding: '13px 14px',
        cursor: 'pointer',
        borderLeft: selected
          ? '3px solid var(--r-gold)'
          : health === 'hot'
          ? '3px solid var(--r-warning)'
          : health === 'stale'
          ? '3px solid var(--r-danger)'
          : health === 'needs-followup'
          ? '3px solid var(--r-warning)'
          : '3px solid transparent',
      }}
    >
      {/* Row 1: name + health + status + role */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 5 }}>
        <span style={{ fontFamily: 'var(--r-font-serif)', fontSize: 14, fontWeight: 700, color: 'var(--r-text)' }}>{contact.fullName}</span>
        <HealthChip health={health} />
        <Badge tone={STATUS_TONE[contact.status]}>{contact.status}</Badge>
        <RoleBadge role={contact.role} />
      </div>

      {/* Row 2: source + profile summary */}
      <div style={{ marginBottom: 5 }}>
        {contact.source && (
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--r-text-3)', background: 'rgba(200,164,92,0.04)', border: '1px solid var(--r-border)', borderRadius: 5, padding: '1px 6px', marginRight: 4 }}>
            {contact.source}
          </span>
        )}
        <ProfileSummary subject={contact} />
      </div>

      {/* Row 3: email · phone */}
      <div style={{ fontSize: 11, color: 'var(--r-text-3)', marginBottom: 5 }}>
        {contact.email ?? '—'}{contact.phone ? ` · ${contact.phone}` : ''}
      </div>

      {/* Row 4: agent + last touch */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: agent ? 'var(--r-gold)' : 'var(--r-text-3)', fontStyle: agent ? 'normal' : 'italic' }}>
          {agent ? agent.name : 'Unassigned'}
        </span>
        <span style={{ fontSize: 10, color: 'var(--r-text-3)' }}>
          {age === 0 ? 'Today' : age === 1 ? 'Yesterday' : `${age}d ago`}
        </span>
      </div>

      {/* Row 5: actions */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }} onClick={(e) => e.stopPropagation()}>
        <ActionBtn tone={isHot ? 'hot' : 'default'} onClick={() => onMarkHot(contact.id)}>
          {isHot ? '🔥 Hot' : 'Mark Hot'}
        </ActionBtn>
        <ActionBtn onClick={() => onAddTask(contact.id)}>+ Task</ActionBtn>
        <ActionBtn tone="primary" onClick={onClick}>
          {selected ? 'Viewing →' : 'Detail →'}
        </ActionBtn>
      </div>
    </div>
  );
}

// ── Detail Panel ──────────────────────────────────────────────────────────────

function DetailPanel({
  contact,
  agents,
  properties,
  opportunities,
  tasks,
  isPushing,
  onAddNote,
  onAssignAgent,
  onMarkHot,
  onAddTask,
  onPushToOpportunities,
  onUpdateBuyerProfile,
  onUpdateSellerProfile,
  onUpdateContact,
  onArchiveContact,
  onUnarchiveContact,
  onDeleteContact,
  onClose,
}: {
  contact: Contact;
  agents: { id: string; name: string }[];
  properties: { id: string; address: string }[];
  opportunities: { id: string; contactName: string; stage: string; value: number; propertyAddress?: string }[];
  tasks: { id: string; title: string; completed: boolean; priority: string; contactId?: string }[];
  isPushing?: boolean;
  onAddNote: (id: string, body: string) => void;
  onAssignAgent: (id: string, agentId?: string) => void;
  onMarkHot: (id: string) => void;
  onAddTask: (id: string) => void;
  onPushToOpportunities: (id: string) => void;
  onUpdateBuyerProfile:  (id: string, p: BuyerProfile | null, role: ContactRole) => Promise<void>;
  onUpdateSellerProfile: (id: string, p: SellerProfile | null, role: ContactRole) => Promise<void>;
  onUpdateContact: (id: string, fields: { fullName: string; email?: string; phone?: string; source?: string; role?: ContactRole; newsletterOptIn?: boolean; newsletterTags?: string[] }) => Promise<void>;
  onArchiveContact: (id: string) => Promise<void>;
  onUnarchiveContact: (id: string) => Promise<void>;
  onDeleteContact: (id: string) => Promise<void>;
  onClose: () => void;
}) {
  const [noteText, setNoteText] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [editName,       setEditName]       = useState(contact.fullName);
  const [editEmail,      setEditEmail]      = useState(contact.email  ?? '');
  const [editPhone,      setEditPhone]      = useState(contact.phone  ?? '');
  const [editSource,     setEditSource]     = useState(contact.source ?? '');
  const [editRole,       setEditRole]       = useState<ContactRole>(contact.role ?? 'buyer');
  const [editNewsletter,     setEditNewsletter]     = useState(contact.newsletterOptIn);
  const [editNewsletterTags, setEditNewsletterTags] = useState<string[]>(contact.newsletterTags ?? []);
  const [editSaving,         setEditSaving]         = useState(false);
  const [editError,          setEditError]          = useState('');

  function openEdit() {
    setEditName(contact.fullName);
    setEditEmail(contact.email  ?? '');
    setEditPhone(contact.phone  ?? '');
    setEditSource(contact.source ?? '');
    setEditRole(contact.role ?? 'buyer');
    setEditNewsletter(contact.newsletterOptIn);
    setEditNewsletterTags(contact.newsletterTags ?? []);
    setEditError('');
    setEditMode(true);
  }

  async function handleSaveEdit() {
    if (!editName.trim()) { setEditError('Name is required.'); return; }
    setEditSaving(true);
    setEditError('');
    try {
      await onUpdateContact(contact.id, {
        fullName:        editName,
        email:           editEmail  || undefined,
        phone:           editPhone  || undefined,
        source:          editSource || undefined,
        role:            editRole,
        newsletterOptIn: editNewsletter,
        newsletterTags:  editNewsletter ? editNewsletterTags : [],
      });
      setEditMode(false);
    } catch (e: any) {
      setEditError(e?.message ?? 'Failed to save.');
    } finally {
      setEditSaving(false);
    }
  }

  async function handleArchive() {
    try {
      await onArchiveContact(contact.id);
      onClose();
    } catch (e) {
      console.error('[handleArchive]', e);
    }
  }

  async function handleUnarchive() {
    try {
      await onUnarchiveContact(contact.id);
    } catch (e) {
      console.error('[handleUnarchive]', e);
    }
  }

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await onDeleteContact(contact.id);
      onClose();
    } catch (e) {
      console.error('[handleDelete]', e);
      setDeleting(false);
    }
  }

  const health = getHealth(contact);
  const isHot = contact.tags.includes('hot');
  const linkedProps = properties.filter((p) => contact.linkedPropertyIds.includes(p.id));
  const relatedOpps = opportunities.filter(
    (o) => o.contactName.toLowerCase() === contact.fullName.toLowerCase()
  );
  const relatedTasks = tasks.filter((t) => !t.completed && t.contactId === contact.id);
  const hasOpportunity = relatedOpps.length > 0;
  const age = daysSince(contact.lastActivityAt);

  const handleAddNote = () => {
    const body = noteText.trim();
    if (!body) return;
    onAddNote(contact.id, body);
    setNoteText('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ margin: 0, fontFamily: 'var(--r-font-serif)', fontSize: 22, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--r-text)', lineHeight: 1.1 }}>
            {contact.fullName}
          </h2>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 7 }}>
            <HealthChip health={health} />
            <Badge tone={STATUS_TONE[contact.status]}>{contact.status}</Badge>
            {contact.source && (
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--r-text-3)', background: 'rgba(200,164,92,0.06)', border: '1px solid var(--r-border)', borderRadius: 6, padding: '2px 8px' }}>
                {contact.source}
              </span>
            )}
            {contact.tags.filter((t) => t !== 'hot').map((tag) => (
              <span key={tag} style={{ fontSize: 11, fontWeight: 600, color: 'var(--r-gold)', background: 'var(--r-gold-faint)', border: '1px solid var(--r-border)', borderRadius: 6, padding: '2px 8px' }}>
                #{tag}
              </span>
            ))}
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: '1px solid var(--r-border)', borderRadius: 8, color: 'var(--r-text-3)', fontSize: 13, padding: '5px 10px', cursor: 'pointer' }}>
          ✕
        </button>
      </div>

      {/* Action strip */}
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', paddingBottom: 14, borderBottom: '1px solid var(--r-border)' }}>
        <ActionBtn tone={isHot ? 'hot' : 'default'} onClick={() => onMarkHot(contact.id)}>
          {isHot ? '🔥 Hot' : 'Mark Hot'}
        </ActionBtn>
        <ActionBtn onClick={() => onAddTask(contact.id)}>+ Task</ActionBtn>
        <ActionBtn
          tone="success"
          onClick={() => onPushToOpportunities(contact.id)}
          disabled={hasOpportunity || contact.status === 'closed' || isPushing}
        >
          {hasOpportunity ? '✓ In Pipeline' : isPushing ? 'Adding…' : '→ Push to Pipeline'}
        </ActionBtn>
        <ActionBtn tone="primary" onClick={openEdit}>Edit</ActionBtn>
        {contact.status === 'closed' ? (
          <ActionBtn tone="success" onClick={handleUnarchive}>Restore</ActionBtn>
        ) : (
          <ActionBtn tone="danger" onClick={handleArchive}>Archive</ActionBtn>
        )}
        <ActionBtn tone="danger" onClick={() => setConfirmDelete(true)} disabled={confirmDelete}>Delete Permanently</ActionBtn>
      </div>

      {/* Delete confirmation — only shown after clicking Delete Permanently */}
      {confirmDelete && (
        <Panel style={{ border: '1px solid var(--r-danger-border)', background: 'var(--r-danger-bg)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--r-danger)', marginBottom: 8 }}>
            Permanently delete {contact.fullName}?
          </div>
          <div style={{ fontSize: 12, color: 'var(--r-text-2)', marginBottom: 12, lineHeight: 1.5 }}>
            This will permanently remove the contact, all associated notes, and all linked tasks. This action cannot be undone.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <ActionBtn tone="danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Yes, Delete Permanently'}
            </ActionBtn>
            <ActionBtn onClick={() => setConfirmDelete(false)}>Cancel</ActionBtn>
          </div>
        </Panel>
      )}

      {/* Inline edit form */}
      {editMode && (
        <Panel>
          <SubHeader>Edit Contact</SubHeader>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div>
              <FieldLabel>Full Name *</FieldLabel>
              <input value={editName} onChange={(e) => setEditName(e.target.value)} style={{ ...inputStyle, fontSize: 13 }} />
            </div>
            <div>
              <FieldLabel>Email</FieldLabel>
              <input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} type="email" style={{ ...inputStyle, fontSize: 13 }} />
            </div>
            <div>
              <FieldLabel>Phone</FieldLabel>
              <input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} type="tel" style={{ ...inputStyle, fontSize: 13 }} />
            </div>
            <div>
              <FieldLabel>Source</FieldLabel>
              <input value={editSource} onChange={(e) => setEditSource(e.target.value)} style={{ ...inputStyle, fontSize: 13 }} />
            </div>
            <div>
              <FieldLabel>Role</FieldLabel>
              <select value={editRole} onChange={(e) => setEditRole(e.target.value as ContactRole)} style={{ ...selectStyle, fontSize: 13 }}>
                <option value="buyer">Buyer</option>
                <option value="seller">Seller</option>
                <option value="both">Both</option>
              </select>
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: 'var(--r-text-2)', userSelect: 'none', marginBottom: editNewsletter ? 6 : 10 }}>
            <input
              type="checkbox"
              checked={editNewsletter}
              onChange={(e) => setEditNewsletter(e.target.checked)}
              style={{ accentColor: 'var(--r-gold)', width: 14, height: 14, cursor: 'pointer' }}
            />
            Newsletter list
          </label>
          {editNewsletter && (
            <NewsletterTagInput tags={editNewsletterTags} onChange={setEditNewsletterTags} />
          )}
          {editError && <div style={{ fontSize: 12, color: 'var(--r-danger)', marginBottom: 8 }}>{editError}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <ActionBtn tone="primary" onClick={handleSaveEdit} disabled={editSaving}>{editSaving ? 'Saving…' : 'Save Changes'}</ActionBtn>
            <ActionBtn onClick={() => setEditMode(false)}>Cancel</ActionBtn>
          </div>
        </Panel>
      )}

      {/* Contact info + agent */}
      <Panel>
        <SubHeader>Contact Info</SubHeader>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 10, color: 'var(--r-text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Email</div>
            <div style={{ fontSize: 13, color: contact.email ? 'var(--r-text)' : 'var(--r-text-3)', fontStyle: contact.email ? 'normal' : 'italic' }}>
              {contact.email ?? 'Not on file'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--r-text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Phone</div>
            <div style={{ fontSize: 13, color: contact.phone ? 'var(--r-text)' : 'var(--r-text-3)', fontStyle: contact.phone ? 'normal' : 'italic' }}>
              {contact.phone ?? 'Not on file'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--r-text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Last Touch</div>
            <div style={{ fontSize: 13, color: 'var(--r-text)' }}>
              {age === 0 ? 'Today' : age === 1 ? 'Yesterday' : `${age} days ago`}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--r-text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>Agent</div>
            <select
              value={contact.assignedAgentId ?? ''}
              onChange={(e) => onAssignAgent(contact.id, e.target.value || undefined)}
              style={{ background: 'rgba(200,164,92,0.06)', border: '1px solid var(--r-border)', borderRadius: 7, color: contact.assignedAgentId ? 'var(--r-text)' : 'var(--r-text-3)', fontSize: 12, fontWeight: 600, padding: '4px 8px', cursor: 'pointer', width: '100%' }}
            >
              <option value="">Unassigned</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--r-text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Newsletter</div>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              fontSize: 12, fontWeight: 600,
              color:      contact.newsletterOptIn ? 'var(--r-success)'        : 'var(--r-text-3)',
              background: contact.newsletterOptIn ? 'var(--r-success-bg)'     : 'rgba(200,164,92,0.04)',
              border:     `1px solid ${contact.newsletterOptIn ? 'var(--r-success-border)' : 'var(--r-border)'}`,
              borderRadius: 6, padding: '2px 8px',
            }}>
              {contact.newsletterOptIn ? '✓ Subscribed' : 'Not subscribed'}
            </span>
          </div>
        </div>
      </Panel>

      {/* Buyer / Seller profile */}
      <Panel>
        <SubHeader>Profile</SubHeader>
        <ProfilePanel
          subject={contact}
          onUpdateBuyerProfile={onUpdateBuyerProfile}
          onUpdateSellerProfile={onUpdateSellerProfile}
        />
      </Panel>

      {/* Linked properties */}
      {linkedProps.length > 0 && (
        <Panel>
          <SubHeader>Linked Properties</SubHeader>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            {linkedProps.map((p) => (
              <span key={p.id} style={{ fontSize: 12, fontWeight: 600, color: 'var(--r-success)', background: 'var(--r-success-bg)', border: '1px solid var(--r-success-border)', borderRadius: 7, padding: '4px 10px' }}>
                {p.address}
              </span>
            ))}
          </div>
        </Panel>
      )}

      {/* Related opportunities */}
      {relatedOpps.length > 0 && (
        <Panel>
          <SubHeader>Pipeline Deals</SubHeader>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {relatedOpps.map((o) => (
              <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', borderRadius: 9, background: 'rgba(200,164,92,0.03)', border: '1px solid var(--r-border)' }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--r-text)' }}>{o.propertyAddress ?? 'Property TBD'}</div>
                  <div style={{ fontSize: 11, color: 'var(--r-text-3)', marginTop: 1 }}>{o.value > 0 ? fmtValue(o.value) : 'Value TBD'}</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: STAGE_COLOR[o.stage] ?? 'var(--r-gold)', background: 'rgba(200,164,92,0.06)', borderRadius: 6, padding: '2px 8px' }}>
                  {o.stage.charAt(0).toUpperCase() + o.stage.slice(1)}
                </span>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* Related tasks */}
      {relatedTasks.length > 0 && (
        <Panel>
          <SubHeader>Open Tasks</SubHeader>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {relatedTasks.map((t) => (
              <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 10px', borderRadius: 8, background: 'rgba(200,164,92,0.03)', border: '1px solid var(--r-border)' }}>
                <span style={{ fontSize: 12, color: 'var(--r-text-2)' }}>{t.title}</span>
                <Badge tone={t.priority === 'high' ? 'danger' : t.priority === 'medium' ? 'warning' : 'default'}>
                  {t.priority}
                </Badge>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* Notes */}
      <Panel>
        <SubHeader>Notes ({contact.notes.length})</SubHeader>
        {contact.notes.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
            {[...contact.notes].reverse().map((note) => (
              <div key={note.id} style={{ padding: '9px 11px', borderRadius: 9, background: 'rgba(200,164,92,0.03)', border: '1px solid var(--r-border)' }}>
                <div style={{ fontSize: 13, color: 'var(--r-text-2)', lineHeight: 1.5 }}>{note.body}</div>
                <div style={{ fontSize: 10, color: 'var(--r-text-3)', marginTop: 4 }}>
                  {new Date(note.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--r-text-3)', fontStyle: 'italic', marginBottom: 10 }}>No notes yet.</div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Add a note about this contact..."
            rows={2}
            style={{ width: '100%', resize: 'vertical', padding: '8px 10px', borderRadius: 9, border: '1px solid var(--r-border)', background: 'rgba(200,164,92,0.04)', color: 'var(--r-text)', fontSize: 12, lineHeight: 1.5, boxSizing: 'border-box' }}
          />
          <ActionBtn tone="primary" onClick={handleAddNote} disabled={!noteText.trim()}>
            Save Note
          </ActionBtn>
        </div>
      </Panel>

      {/* Recommended next action */}
      <Panel style={{ background: 'var(--r-gold-faint)', border: '1px solid var(--r-border)' }}>
        <SubHeader>Recommended Next Action</SubHeader>
        <div style={{ fontSize: 13, color: 'var(--r-text-2)', lineHeight: 1.55 }}>
          {NEXT_ACTION[health]}
        </div>
        <div style={{ marginTop: 10, display: 'flex', gap: 7 }}>
          <ActionBtn onClick={() => onAddTask(contact.id)}>Create Task</ActionBtn>
          {!hasOpportunity && contact.status !== 'closed' && (
            <ActionBtn tone="success" onClick={() => onPushToOpportunities(contact.id)}>
              → Move to Pipeline
            </ActionBtn>
          )}
        </div>
      </Panel>

      {/* Cross-links */}
      <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
        {[
          { href: '/leads', label: '← Leads' },
          { href: '/opportunities', label: '→ Pipeline' },
          { href: '/tasks', label: '→ Tasks' },
        ].map(({ href, label }) => (
          <a key={href} href={href} style={{ flex: 1, display: 'block', textAlign: 'center', padding: '8px', borderRadius: 9, border: '1px solid var(--r-border)', background: 'rgba(200,164,92,0.03)', fontSize: 12, fontWeight: 700, color: 'var(--r-gold)', textDecoration: 'none' }}>
            {label}
          </a>
        ))}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ContactsPage() {
  // Hydrate contacts from Supabase on mount (replaces mock data unconditionally).
  // Provides Supabase-backed mutations for the three ops that have DB wiring.
  const {
    contacts,
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
  } = useContacts();

  // Hydrate agents from Supabase so agent names resolve correctly in the UI.
  useAgents();

  const agents        = useAppStore((s) => s.agents);
  const properties    = useAppStore((s) => s.properties);
  const opportunities = useAppStore((s) => s.opportunities);
  const tasks         = useAppStore((s) => s.tasks);
  const currentRole   = useAppStore((s) => s.currentRole);
  const memberId      = useAppStore((s) => s.memberId);

  const { createTask }         = useTasks();
  const { createOpportunity }  = useOpportunities();

  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [pushingId, setPushingId] = useState<string | null>(null);
  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  async function handleMarkHot(contactId: string) {
    const c = contacts.find((x) => x.id === contactId);
    const wasHot = c?.tags.includes('hot') ?? false;
    try {
      await markContactHot(contactId);
      showToast(wasHot ? `${c?.fullName ?? 'Contact'} removed from hot` : `${c?.fullName ?? 'Contact'} marked hot`);
    } catch (err) {
      console.error('[handleMarkHot]', err);
      showToast('Failed to update', false);
    }
  }

  async function handleAddContactTask(contactId: string) {
    const c = contacts.find((x) => x.id === contactId);
    if (!c) return;
    try {
      await createTask({
        title:     `Follow up with ${c.fullName}`,
        priority:  c.tags.includes('hot') ? 'high' : 'medium',
        contactId,
      });
      showToast(`Task created for ${c.fullName}`);
    } catch (err) {
      console.error('[handleAddContactTask]', err);
      showToast('Failed to create task', false);
    }
  }

  async function pushContactToOpportunities(contactId: string) {
    const c = contacts.find((x) => x.id === contactId);
    if (!c) return;
    const alreadyExists = opportunities.some(
      (o) => o.contactName.toLowerCase() === c.fullName.toLowerCase()
    );
    if (alreadyExists) {
      showToast(`${c.fullName} is already in the pipeline`, false);
      return;
    }
    const firstProp = properties.find((p) => c.linkedPropertyIds.includes(p.id));
    const pipelineType = (c.role === 'seller' || (c.sellerProfile && !c.buyerProfile))
      ? 'seller' as const
      : 'buyer' as const;
    // Agents assign to themselves; brokers carry the contact's stored assignment.
    const agentId = (currentRole === 'agent' && memberId) ? memberId : (c.assignedAgentId ?? undefined);
    setPushingId(contactId);
    try {
      await createOpportunity({
        contactName:        c.fullName,
        propertyAddress:    firstProp?.address,
        propertyId:         firstProp?.id,
        assignedAgentId:    agentId,
        pipelineType,
        stage:              'lead_received',
        value:              0,
        probability:        15,
        priority:           'medium',
        nextStep:           'Initial qualification — review profile and schedule intro call.',
        notes:              c.notes.length > 0 ? [c.notes[c.notes.length - 1].body] : [],
      });
      showToast(`${c.fullName} added to ${pipelineType} pipeline`);
    } catch (err: any) {
      console.error('[pushContactToOpportunities]', err);
      showToast(err?.message ?? 'Failed to push to pipeline', false);
    } finally {
      setPushingId(null);
    }
  }

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [query, setQuery] = useState('');

  // ── Add Contact form state ─────────────────────────────────────────────────
  const [showAddForm,  setShowAddForm]  = useState(false);
  const [addName,      setAddName]      = useState('');
  const [addEmail,     setAddEmail]     = useState('');
  const [addPhone,     setAddPhone]     = useState('');
  const [addSource,    setAddSource]    = useState('');
  const [addRole,      setAddRole]      = useState<ContactRole>('buyer');
  const [addBuyer,     setAddBuyer]     = useState<BuyerProfile>(EMPTY_BUYER);
  const [addSeller,    setAddSeller]    = useState<SellerProfile>(EMPTY_SELLER);
  const [addNewsletter,     setAddNewsletter]     = useState(false);
  const [addNewsletterTags, setAddNewsletterTags] = useState<string[]>([]);
  const [addError,     setAddError]     = useState('');
  const [addSaving,    setAddSaving]    = useState(false);

  function resetAddForm() {
    setShowAddForm(false);
    setAddName(''); setAddEmail(''); setAddPhone(''); setAddSource('');
    setAddRole('buyer'); setAddBuyer(EMPTY_BUYER); setAddSeller(EMPTY_SELLER);
    setAddNewsletter(false); setAddNewsletterTags([]); setAddError('');
  }

  async function handleAddContact() {
    if (!addName.trim()) { setAddError('Full name is required.'); return; }
    setAddSaving(true);
    setAddError('');
    try {
      const result = await createContact({
        fullName:        addName,
        email:           addEmail  || undefined,
        phone:           addPhone  || undefined,
        source:          addSource || undefined,
        role:            addRole,
        buyerProfile:    (addRole === 'buyer'  || addRole === 'both') ? addBuyer  : undefined,
        sellerProfile:   (addRole === 'seller' || addRole === 'both') ? addSeller : undefined,
        newsletterOptIn: addNewsletter,
        newsletterTags:  addNewsletter ? addNewsletterTags : [],
      });
      resetAddForm();
      if (result.syncError && !result.propertyCreated && !result.propertyUpdated) {
        showToast(`Contact saved — property sync failed: ${result.syncError}`, false);
      } else if (result.propertyCreated) {
        showToast(result.syncError ? `Contact saved — property created (area keys not indexed yet)` : `Contact saved — prospect property created`, !result.syncError);
      } else if (result.propertyUpdated) {
        showToast(`Contact saved — existing property updated`);
      } else if (result.taskCreated) {
        showToast(`Contact saved — follow-up task created to collect property details`);
      } else {
        showToast(`Contact saved`);
      }
    } catch (e: any) {
      setAddError(e?.message ?? 'Failed to create contact.');
    } finally {
      setAddSaving(false);
    }
  }

  async function handleUpdateSellerProfile(
    contactId: string,
    profile:   SellerProfile | null,
    role:      ContactRole,
  ) {
    const result = await updateSellerProfile(contactId, profile, role);
    if (result.syncError && !result.propertyCreated && !result.propertyUpdated) {
      showToast(`Seller profile saved — property sync failed: ${result.syncError}`, false);
    } else if (result.propertyCreated) {
      showToast(result.syncError ? `Seller profile saved — property created (area keys not indexed yet)` : `Seller profile saved — prospect property created`, !result.syncError);
    } else if (result.propertyUpdated) {
      showToast(`Seller profile saved — existing property updated`);
    } else if (result.taskCreated) {
      showToast(`Seller profile saved — follow-up task created`);
    } else {
      showToast(`Seller profile saved`);
    }
  }

  const scopedContacts = useMemo(() => {
    if (currentRole !== 'agent' || !memberId) return contacts;
    return contacts.filter((c) => c.assignedAgentId === memberId);
  }, [contacts, currentRole, memberId]);

  const active = useMemo(() => scopedContacts.filter((c) => c.status === 'active'), [scopedContacts]);
  const hot = useMemo(() => scopedContacts.filter((c) => c.tags.includes('hot')), [scopedContacts]);
  const buyers  = useMemo(() => scopedContacts.filter((c) => c.role === 'buyer'  || c.role === 'both' || c.tags.includes('buyer')),  [scopedContacts]);
  const sellers = useMemo(() => scopedContacts.filter((c) => c.role === 'seller' || c.role === 'both' || c.tags.includes('seller')), [scopedContacts]);
  const recentlyUpdated = useMemo(
    () => scopedContacts.filter((c) => daysSince(c.lastActivityAt) <= 3),
    [scopedContacts]
  );

  const filtered = useMemo(() => {
    return contacts.filter((c) => {
      if (currentRole === 'agent' && memberId && c.assignedAgentId !== memberId) return false;

      const q = query.toLowerCase().trim();
      const matchSearch =
        !q ||
        [c.fullName, c.email ?? '', c.phone ?? '', c.source ?? '', ...c.tags]
          .join(' ')
          .toLowerCase()
          .includes(q);

      const matchFilter =
        filter === 'all'      ? true :
        filter === 'buyers'   ? (c.role === 'buyer'  || c.role === 'both' || c.tags.includes('buyer'))  :
        filter === 'sellers'  ? (c.role === 'seller' || c.role === 'both' || c.tags.includes('seller')) :
        filter === 'investors'? (c.buyerProfile?.tags.includes('investor') ?? c.tags.includes('investor')) :
        filter === 'active'   ? c.status === 'active'  :
        filter === 'hot'      ? c.tags.includes('hot') :
        filter === 'archived' ? c.status === 'closed'  :
        true;

      return matchSearch && matchFilter;
    });
  }, [contacts, filter, query, currentRole, memberId]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const aHot = a.tags.includes('hot') ? 2 : 0;
      const bHot = b.tags.includes('hot') ? 2 : 0;
      const aHealth = getHealth(a);
      const bHealth = getHealth(b);
      const healthScore = (h: Health) => h === 'stale' ? -1 : h === 'needs-followup' ? 0 : 1;
      if (bHot !== aHot) return bHot - aHot;
      if (healthScore(aHealth) !== healthScore(bHealth)) return healthScore(bHealth) - healthScore(aHealth);
      return new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime();
    });
  }, [filtered]);

  const selectedContact = useMemo(
    () => contacts.find((c) => c.id === selectedId) ?? null,
    [contacts, selectedId]
  );

  const handleSelect = (id: string) => {
    setSelectedId((prev) => (prev === id ? null : id));
  };

  return (
    <AppShell>
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 999,
          padding: '12px 20px', borderRadius: 12,
          background: toast.ok ? 'var(--r-success-bg)' : 'var(--r-danger-bg)',
          border: `1px solid ${toast.ok ? 'var(--r-success-border)' : 'var(--r-danger-border)'}`,
          color: toast.ok ? 'var(--r-success)' : 'var(--r-danger)',
          fontSize: 13, fontWeight: 700, boxShadow: 'var(--r-shadow)',
        }}>
          {toast.msg}
        </div>
      )}
      {/* ── Header ── */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontFamily: 'var(--r-font-serif)', fontSize: 34, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--r-text)', lineHeight: 1.08 }}>
          Contacts
        </h1>
        <p style={{ margin: '8px 0 0', fontSize: 14, color: 'var(--r-text-2)' }}>
          Relationship command center — active clients, converted leads, and ongoing account management.
        </p>
      </div>

      {/* ── A. KPI Strip ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 24 }}>
        <StatCard label="Total Contacts" value={scopedContacts.length} subtext={`${active.length} active`} />
        <StatCard label="Active Clients" value={active.length} subtext="Ongoing relationships" />
        <StatCard label="Hot" value={hot.length} subtext="Priority attention" />
        <StatCard label="Buyers / Sellers" value={`${buyers.length} / ${sellers.length}`} subtext="By role tag" />
        <StatCard label="Recent Touch" value={recentlyUpdated.length} subtext="Updated ≤ 3 days" />
      </div>

      {/* ── B. Search + Filter ── */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 240px', minWidth: 200 }}>
          <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: 'var(--r-text-3)', pointerEvents: 'none' }}>⌕</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, email, tag..."
            style={{ width: '100%', padding: '9px 12px 9px 32px', borderRadius: 10, border: '1px solid var(--r-border)', background: 'rgba(200,164,92,0.04)', color: 'var(--r-text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {FILTER_TABS.map(({ key, label }) => {
            const isActive = filter === key;
            return (
              <button key={key} onClick={() => setFilter(key)} className="r-tab" style={{ padding: '7px 13px', borderRadius: 9, border: '1px solid var(--r-border)', background: isActive ? 'var(--r-gold-faint)' : 'rgba(200,164,92,0.04)', color: isActive ? 'var(--r-gold-bright)' : 'var(--r-text-2)', fontSize: 12, fontWeight: isActive ? 700 : 500, cursor: 'pointer' }}>
                {label}
              </button>
            );
          })}
        </div>

        {/* Add Contact button */}
        <button
          onClick={() => setShowAddForm((v) => !v)}
          style={{
            background: showAddForm ? 'var(--r-gold-faint)' : 'rgba(200,164,92,0.06)',
            border: '1px solid var(--r-border)',
            color: 'var(--r-gold-bright)',
            padding: '7px 15px',
            borderRadius: 9,
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            letterSpacing: '0.01em',
          }}
        >
          + Add Contact
        </button>
      </div>

      {/* ── Add Contact inline form ── */}
      {showAddForm && (
        <div style={{ marginBottom: 18, borderRadius: 14, background: 'var(--r-grad-card)', border: '1px solid var(--r-border)', boxShadow: 'var(--r-shadow)', padding: '20px 22px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--r-text)', marginBottom: 16, fontFamily: 'var(--r-font-serif)' }}>New Contact</div>

          {/* Basic fields */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <div>
              <FieldLabel>Full Name *</FieldLabel>
              <input value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="Jane Smith" style={{ ...inputStyle, fontSize: 13 }} />
            </div>
            <div>
              <FieldLabel>Email</FieldLabel>
              <input value={addEmail} onChange={(e) => setAddEmail(e.target.value)} placeholder="jane@example.com" type="email" style={{ ...inputStyle, fontSize: 13 }} />
            </div>
            <div>
              <FieldLabel>Phone</FieldLabel>
              <input value={addPhone} onChange={(e) => setAddPhone(e.target.value)} placeholder="(555) 000-0000" type="tel" style={{ ...inputStyle, fontSize: 13 }} />
            </div>
            <div>
              <FieldLabel>Source</FieldLabel>
              <input value={addSource} onChange={(e) => setAddSource(e.target.value)} placeholder="Referral, Website..." style={{ ...inputStyle, fontSize: 13 }} />
            </div>
          </div>

          <ProfileFormSection
            role={addRole}     setRole={setAddRole}
            buyer={addBuyer}   setBuyer={setAddBuyer}
            seller={addSeller} setSeller={setAddSeller}
          />

          {/* Newsletter opt-in */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: 'var(--r-text-2)', userSelect: 'none', marginTop: 6, marginBottom: addNewsletter ? 6 : 10 }}>
            <input
              type="checkbox"
              checked={addNewsletter}
              onChange={(e) => setAddNewsletter(e.target.checked)}
              style={{ accentColor: 'var(--r-gold)', width: 14, height: 14, cursor: 'pointer' }}
            />
            Add to newsletter list
          </label>
          {addNewsletter && (
            <NewsletterTagInput tags={addNewsletterTags} onChange={setAddNewsletterTags} />
          )}

          {addError && <div style={{ fontSize: 12, color: 'var(--r-danger)', marginBottom: 10 }}>{addError}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <ActionBtn tone="primary" onClick={handleAddContact} disabled={addSaving}>{addSaving ? 'Saving…' : 'Save Contact'}</ActionBtn>
            <ActionBtn tone="default" onClick={resetAddForm}>Cancel</ActionBtn>
          </div>
        </div>
      )}

      {/* ── C/D/E/F. Main split-pane ── */}
      <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>

        {/* Left: Contact list */}
        <div style={{ flex: '0 0 400px', display: 'flex', flexDirection: 'column', gap: 9 }}>
          {sorted.length === 0 ? (
            <div style={{ padding: '36px 20px', textAlign: 'center', borderRadius: 14, border: '1px solid var(--r-border)', background: 'rgba(200,164,92,0.02)', color: 'var(--r-text-3)', fontSize: 13 }}>
              No contacts match your current filter.
            </div>
          ) : (
            sorted.map((c) => (
              <ContactRow
                key={c.id}
                contact={c}
                agents={agents}
                selected={selectedId === c.id}
                onClick={() => handleSelect(c.id)}
                onMarkHot={handleMarkHot}
                onAddTask={handleAddContactTask}
              />
            ))
          )}
        </div>

        {/* Right: Detail panel or empty prompt */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {selectedContact ? (
            <DetailPanel
              contact={selectedContact}
              agents={agents}
              properties={properties}
              opportunities={opportunities}
              tasks={tasks}
              isPushing={pushingId === selectedContact?.id}
              onAddNote={addContactNote}
              onAssignAgent={assignContactToAgent}
              onMarkHot={handleMarkHot}
              onAddTask={handleAddContactTask}
              onPushToOpportunities={pushContactToOpportunities}
              onUpdateBuyerProfile={updateBuyerProfile}
              onUpdateSellerProfile={handleUpdateSellerProfile}
              onUpdateContact={updateContact}
              onArchiveContact={archiveContact}
              onUnarchiveContact={unarchiveContact}
              onDeleteContact={deleteContact}
              onClose={() => setSelectedId(null)}
            />
          ) : (
            <div style={{ borderRadius: 16, border: '1px dashed var(--r-border)', padding: '60px 32px', textAlign: 'center', color: 'var(--r-text-3)' }}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>↖</div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Select a contact</div>
              <div style={{ fontSize: 12 }}>View full profile, notes, linked deals, and take action.</div>
            </div>
          )}
        </div>
      </div>

    </AppShell>
  );
}
