'use client';

export const dynamic = 'force-dynamic';

import { useMemo, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import { useAppStore } from '@/app/store/useAppStore';
import { useLeads } from '@/hooks/useLeads';
import { useTasks } from '@/hooks/useTasks';
import type { Lead, LeadStatus, ContactRole, BuyerProfile, SellerProfile } from '@/features/opportunities/types';
import {
  EMPTY_BUYER, EMPTY_SELLER,
  RoleBadge, ProfileSummary, ProfilePanel, ProfileFormSection,
  FieldLabel, inputStyle, selectStyle,
} from '@/components/crm/ProfileUi';

// ── Config ────────────────────────────────────────────────────────────────────

const STATUS_META: Record<
  LeadStatus,
  { label: string; tone: 'default' | 'warning' | 'success' | 'danger'; accent: string }
> = {
  new: { label: 'New', tone: 'default', accent: 'rgba(200,164,92,0.6)' },
  contacted: { label: 'Contacted', tone: 'warning', accent: 'rgba(200,130,60,0.6)' },
  qualified: { label: 'Qualified', tone: 'success', accent: 'rgba(90,140,94,0.6)' },
  lost: { label: 'Lost / Archived', tone: 'danger', accent: 'rgba(176,58,58,0.5)' },
};

const NEXT_ACTION: Record<LeadStatus, string> = {
  new: 'Make first contact — call or send intro email',
  contacted: 'Send follow-up; gauge interest and qualify budget',
  qualified: 'Ready to convert — move to pipeline or active contact',
  lost: 'Consider re-engagement or close record',
};

type FilterTab = 'all' | 'new' | 'hot' | 'contacted' | 'qualified' | 'lost';

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'new', label: 'New' },
  { key: 'hot', label: 'Hot' },
  { key: 'contacted', label: 'Contacted' },
  { key: 'qualified', label: 'Qualified' },
  { key: 'lost', label: 'Lost' },
];

// ── Micro-components ──────────────────────────────────────────────────────────

function ActionBtn({
  children,
  onClick,
  tone = 'default',
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  tone?: 'default' | 'primary' | 'success' | 'danger' | 'hot';
  disabled?: boolean;
}) {
  const styles: Record<string, React.CSSProperties> = {
    default: {
      background: 'rgba(200,164,92,0.06)',
      border: '1px solid rgba(200,164,92,0.16)',
      color: 'var(--r-text-2)',
    },
    primary: {
      background: 'var(--r-gold-faint)',
      border: '1px solid var(--r-border)',
      color: 'var(--r-gold-bright)',
    },
    success: {
      background: 'var(--r-success-bg)',
      border: '1px solid var(--r-success-border)',
      color: 'var(--r-success)',
    },
    danger: {
      background: 'var(--r-danger-bg)',
      border: '1px solid var(--r-danger-border)',
      color: 'var(--r-danger)',
    },
    hot: {
      background: 'var(--r-warning-bg)',
      border: '1px solid var(--r-warning-border)',
      color: 'var(--r-warning)',
    },
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        ...(styles[tone] ?? styles.default),
        padding: '6px 12px',
        borderRadius: 9,
        fontSize: 12,
        fontWeight: 700,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        letterSpacing: '0.01em',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  );
}

function TagChip({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: 6,
        fontSize: 11,
        fontWeight: 600,
        background: 'var(--r-gold-faint)',
        border: '1px solid var(--r-border)',
        color: 'var(--r-gold)',
        letterSpacing: '0.01em',
      }}
    >
      #{children}
    </span>
  );
}

// ── Lead card ─────────────────────────────────────────────────────────────────

function LeadCard({
  lead,
  agents,
  properties,
  onConvert,
  onAssign,
  onMarkHot,
  onAddTask,
  onUpdateStatus,
  onUpdateBuyerProfile,
  onUpdateSellerProfile,
  onUpdateLead,
  onDeleteLead,
}: {
  lead: Lead;
  agents: { id: string; name: string; email: string }[];
  properties: { id: string; address: string }[];
  onConvert: (id: string) => void;
  onAssign: (id: string, agentId: string | undefined) => void;
  onMarkHot: (id: string) => void;
  onAddTask: (id: string) => void;
  onUpdateStatus: (id: string, status: LeadStatus) => void;
  onUpdateBuyerProfile:  (id: string, p: BuyerProfile  | null, role: ContactRole) => Promise<void>;
  onUpdateSellerProfile: (id: string, p: SellerProfile | null, role: ContactRole) => Promise<void>;
  onUpdateLead: (id: string, fields: { fullName: string; email?: string; phone?: string; source?: string; role?: ContactRole }) => Promise<void>;
  onDeleteLead: (id: string) => Promise<void>;
}) {
  const isHot = lead.tags.includes('hot');
  const meta = STATUS_META[lead.status];
  const latestNote = lead.notes.at(-1);
  const linkedProps = properties.filter((p) => lead.linkedPropertyIds.includes(p.id));
  const nextAction = NEXT_ACTION[lead.status];
  const [showProfile, setShowProfile] = useState(false);

  // ── Edit state ──────────────────────────────────────────────────────────────
  const [showEdit,   setShowEdit]   = useState(false);
  const [editName,   setEditName]   = useState(lead.fullName);
  const [editEmail,  setEditEmail]  = useState(lead.email  ?? '');
  const [editPhone,  setEditPhone]  = useState(lead.phone  ?? '');
  const [editSource, setEditSource] = useState(lead.source ?? '');
  const [editRole,   setEditRole]   = useState<ContactRole>(lead.role ?? 'buyer');
  const [editSaving, setEditSaving] = useState(false);
  const [editError,  setEditError]  = useState('');

  function openEdit() {
    setEditName(lead.fullName);
    setEditEmail(lead.email  ?? '');
    setEditPhone(lead.phone  ?? '');
    setEditSource(lead.source ?? '');
    setEditRole(lead.role ?? 'buyer');
    setEditError('');
    setShowEdit(true);
    setShowProfile(false);
  }

  async function handleSaveEdit() {
    if (!editName.trim()) { setEditError('Name is required.'); return; }
    setEditSaving(true);
    setEditError('');
    try {
      await onUpdateLead(lead.id, {
        fullName: editName,
        email:    editEmail  || undefined,
        phone:    editPhone  || undefined,
        source:   editSource || undefined,
        role:     editRole,
      });
      setShowEdit(false);
    } catch (e: any) {
      setEditError(e?.message ?? 'Failed to save.');
    } finally {
      setEditSaving(false);
    }
  }

  // ── Delete confirm state ────────────────────────────────────────────────────
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting,      setDeleting]      = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await onDeleteLead(lead.id);
    } catch (e) {
      console.error('[handleDelete lead]', e);
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  const timeAgo = (() => {
    const ms = Date.now() - new Date(lead.updatedAt).getTime();
    const days = Math.floor(ms / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    return `${days}d ago`;
  })();

  return (
    <div
      className="r-card"
      style={{
        borderRadius: 16,
        background: 'var(--r-grad-card)',
        border: '1px solid var(--r-border)',
        boxShadow: 'var(--r-shadow)',
        display: 'flex',
      }}
    >
      {/* Status accent bar */}
      <div
        style={{
          width: 4,
          flexShrink: 0,
          background: meta.accent,
        }}
      />

      <div style={{ flex: 1, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Row 1: Name + badges + time */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span
              style={{
                fontFamily: 'var(--r-font-serif)',
                fontSize: 16,
                fontWeight: 700,
                color: 'var(--r-text)',
              }}
            >
              {lead.fullName}
            </span>
            <Badge tone={meta.tone}>{meta.label}</Badge>
            {isHot && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '3px 9px',
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 800,
                  background: 'var(--r-warning-bg)',
                  border: '1px solid var(--r-warning-border)',
                  color: 'var(--r-warning)',
                  letterSpacing: '0.04em',
                }}
              >
                HOT
              </span>
            )}
            {lead.source && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--r-text-3)',
                  background: 'rgba(200,164,92,0.06)',
                  border: '1px solid var(--r-border)',
                  borderRadius: 6,
                  padding: '2px 7px',
                }}
              >
                {lead.source}
              </span>
            )}
            <RoleBadge role={lead.role} />
          </div>
          <span style={{ fontSize: 11, color: 'var(--r-text-3)', whiteSpace: 'nowrap', paddingTop: 3 }}>
            {timeAgo}
          </span>
        </div>

        {/* Row 1.5: Profile summary (compact) */}
        <ProfileSummary subject={lead} />

        {/* Row 2: Contact info + agent + property */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 12,
          }}
        >
          {/* Contact info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--r-text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>
              Contact
            </div>
            <div style={{ fontSize: 13, color: 'var(--r-text-2)' }}>
              {lead.email ?? <span style={{ color: 'var(--r-text-3)', fontStyle: 'italic' }}>No email</span>}
            </div>
            <div style={{ fontSize: 13, color: 'var(--r-text-2)' }}>
              {lead.phone ?? <span style={{ color: 'var(--r-text-3)', fontStyle: 'italic' }}>No phone</span>}
            </div>
          </div>

          {/* Assigned agent */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--r-text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>
              Agent
            </div>
            <select
              value={lead.assignedAgentId ?? ''}
              onChange={(e) => onAssign(lead.id, e.target.value || undefined)}
              style={{
                background: 'rgba(200,164,92,0.06)',
                border: '1px solid var(--r-border)',
                borderRadius: 8,
                color: lead.assignedAgentId ? 'var(--r-text)' : 'var(--r-text-3)',
                fontSize: 12,
                fontWeight: 600,
                padding: '5px 8px',
                cursor: 'pointer',
                maxWidth: 160,
              }}
            >
              <option value="">Unassigned</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          {/* Linked properties */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--r-text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>
              Properties
            </div>
            {linkedProps.length > 0 ? (
              linkedProps.map((p) => (
                <span
                  key={p.id}
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--r-success)',
                    background: 'var(--r-success-bg)',
                    border: '1px solid var(--r-success-border)',
                    borderRadius: 6,
                    padding: '2px 8px',
                    display: 'inline-block',
                  }}
                >
                  {p.address}
                </span>
              ))
            ) : (
              <span style={{ fontSize: 12, color: 'var(--r-text-3)', fontStyle: 'italic' }}>
                None linked
              </span>
            )}
          </div>
        </div>

        {/* Row 3: Next action + latest note */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 12,
          }}
        >
          {/* Next action */}
          <div
            style={{
              background: 'var(--r-gold-faint)',
              border: '1px solid var(--r-border)',
              borderRadius: 10,
              padding: '9px 12px',
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--r-text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
              Next Action
            </div>
            <div style={{ fontSize: 12, color: 'var(--r-text-2)', lineHeight: 1.45 }}>
              {nextAction}
            </div>
          </div>

          {/* Latest note */}
          <div
            style={{
              background: 'rgba(200,164,92,0.03)',
              border: '1px solid var(--r-border)',
              borderRadius: 10,
              padding: '9px 12px',
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--r-text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
              Latest Note
            </div>
            {latestNote ? (
              <div style={{ fontSize: 12, color: 'var(--r-text-2)', fontStyle: 'italic', lineHeight: 1.45, overflow: 'hidden', maxHeight: '2.9em' }}>
                {latestNote.body}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--r-text-3)', fontStyle: 'italic' }}>
                No notes yet
              </div>
            )}
          </div>
        </div>

        {/* Row 4: Actions */}
        <div
          style={{
            display: 'flex',
            gap: 7,
            flexWrap: 'wrap',
            alignItems: 'center',
            paddingTop: 4,
            borderTop: '1px solid var(--r-border)',
          }}
        >
          <ActionBtn
            tone="primary"
            onClick={() => onConvert(lead.id)}
            disabled={lead.status === 'lost'}
          >
            Convert → Contact
          </ActionBtn>

          <ActionBtn tone={isHot ? 'hot' : 'default'} onClick={() => onMarkHot(lead.id)}>
            {isHot ? '🔥 Hot' : 'Mark Hot'}
          </ActionBtn>

          <ActionBtn tone="default" onClick={() => onAddTask(lead.id)}>
            + Task
          </ActionBtn>

          {lead.status !== 'contacted' && lead.status !== 'lost' && (
            <ActionBtn tone="default" onClick={() => onUpdateStatus(lead.id, 'contacted')}>
              Mark Contacted
            </ActionBtn>
          )}

          {lead.status === 'contacted' && (
            <ActionBtn tone="success" onClick={() => onUpdateStatus(lead.id, 'qualified')}>
              Mark Qualified
            </ActionBtn>
          )}

          {lead.status === 'lost' ? (
            <ActionBtn
              tone="success"
              onClick={() => onUpdateStatus(lead.id, 'new')}
            >
              Restore
            </ActionBtn>
          ) : (
            <ActionBtn
              tone="danger"
              onClick={() => onUpdateStatus(lead.id, 'lost')}
            >
              Archive
            </ActionBtn>
          )}

          <ActionBtn tone="default" onClick={() => { setShowProfile((v) => !v); setShowEdit(false); }}>
            {showProfile ? 'Close Profile' : 'Profile'}
          </ActionBtn>
          <ActionBtn tone="primary" onClick={openEdit}>Edit</ActionBtn>
          <ActionBtn tone="danger" onClick={() => { setConfirmDelete(true); setShowEdit(false); setShowProfile(false); }} disabled={confirmDelete}>
            Delete
          </ActionBtn>
        </div>

        {/* Delete confirmation */}
        {confirmDelete && (
          <div style={{ borderTop: '1px solid var(--r-danger-border)', paddingTop: 12, marginTop: 4 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--r-danger)', marginBottom: 6 }}>
              Permanently delete {lead.fullName}?
            </div>
            <div style={{ fontSize: 12, color: 'var(--r-text-2)', marginBottom: 10, lineHeight: 1.5 }}>
              This removes the lead and all associated notes. Tasks linked to this lead will have their link cleared. This cannot be undone.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <ActionBtn tone="danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Yes, Delete Permanently'}
              </ActionBtn>
              <ActionBtn onClick={() => setConfirmDelete(false)}>Cancel</ActionBtn>
            </div>
          </div>
        )}

        {/* Expandable edit form */}
        {showEdit && (
          <div style={{ borderTop: '1px solid var(--r-border)', paddingTop: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--r-text-3)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 10 }}>
              Edit Lead
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <FieldLabel>Full Name *</FieldLabel>
                <input value={editName} onChange={(e) => setEditName(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <FieldLabel>Email</FieldLabel>
                <input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} type="email" style={inputStyle} />
              </div>
              <div>
                <FieldLabel>Phone</FieldLabel>
                <input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} type="tel" style={inputStyle} />
              </div>
              <div>
                <FieldLabel>Source</FieldLabel>
                <input value={editSource} onChange={(e) => setEditSource(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <FieldLabel>Role</FieldLabel>
                <select value={editRole} onChange={(e) => setEditRole(e.target.value as ContactRole)} style={selectStyle}>
                  <option value="buyer">Buyer</option>
                  <option value="seller">Seller</option>
                  <option value="both">Both</option>
                </select>
              </div>
            </div>
            {editError && <div style={{ fontSize: 12, color: 'var(--r-danger)', marginBottom: 8 }}>{editError}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <ActionBtn tone="primary" onClick={handleSaveEdit} disabled={editSaving}>
                {editSaving ? 'Saving…' : 'Save Changes'}
              </ActionBtn>
              <ActionBtn onClick={() => setShowEdit(false)}>Cancel</ActionBtn>
            </div>
          </div>
        )}

        {/* Expandable profile panel */}
        {showProfile && (
          <div style={{ borderTop: '1px solid var(--r-border)', paddingTop: 12 }}>
            <ProfilePanel
              subject={lead}
              onUpdateBuyerProfile={onUpdateBuyerProfile}
              onUpdateSellerProfile={onUpdateSellerProfile}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LeadsPage() {
  // Hydrate leads from Supabase on mount (contacts with stage='lead').
  const {
    leads, createLead, updateLead, deleteLead,
    updateBuyerProfile, updateSellerProfile, convertLead,
    reload: reloadLeads, assignLeadToAgent, markLeadHot, updateLeadStatus,
  } = useLeads();
  const { createTask } = useTasks();

  const agents = useAppStore((s) => s.agents);
  const properties = useAppStore((s) => s.properties);
  const setContacts = useAppStore((s) => s.setContacts);
  const currentRole = useAppStore((s) => s.currentRole);
  const memberId    = useAppStore((s) => s.memberId);

  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  // Convert lead → active contact via Supabase (stage change in-place).
  // After conversion, reload leads and re-fetch contacts so both lists reflect reality.
  async function handleConvertLead(leadId: string) {
    try {
      await convertLead(leadId);
      // Reload contacts so the converted contact appears on the /contacts page.
      const res = await fetch('/api/contacts', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setContacts(data);
      }
    } catch (err) {
      console.error('[handleConvertLead]', err);
    }
  }

  async function handleAddTask(leadId: string) {
    const lead = leads.find((l) => l.id === leadId);
    if (!lead) return;
    try {
      await createTask({
        title:    `Follow up with ${lead.fullName}`,
        priority: lead.tags.includes('hot') ? 'high' : 'medium',
        leadId,
      });
      showToast(`Task created for ${lead.fullName}`);
    } catch (err) {
      console.error('[handleAddTask]', err);
      showToast('Failed to create task', false);
    }
  }

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterTab>('all');

  // ── Add Lead form state ────────────────────────────────────────────────────
  const [showAddForm, setShowAddForm] = useState(false);
  const [addName, setAddName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [addSource, setAddSource] = useState('');
  const [addRole, setAddRole] = useState<ContactRole>('buyer');
  const [addBuyer, setAddBuyer] = useState<BuyerProfile>(EMPTY_BUYER);
  const [addSeller, setAddSeller] = useState<SellerProfile>(EMPTY_SELLER);
  const [addError, setAddError] = useState('');
  const [addSaving, setAddSaving] = useState(false);

  function resetAddForm() {
    setAddName(''); setAddEmail(''); setAddPhone(''); setAddSource('');
    setAddRole('buyer'); setAddBuyer(EMPTY_BUYER); setAddSeller(EMPTY_SELLER);
    setAddError('');
  }

  async function handleAddLead() {
    if (!addName.trim()) { setAddError('Full name is required.'); return; }
    setAddSaving(true);
    setAddError('');
    try {
      await createLead({
        fullName: addName,
        email: addEmail || undefined,
        phone: addPhone || undefined,
        source: addSource || undefined,
        role: addRole,
        buyerProfile: (addRole === 'buyer' || addRole === 'both') ? addBuyer : undefined,
        sellerProfile: (addRole === 'seller' || addRole === 'both') ? addSeller : undefined,
      });
      setShowAddForm(false);
      resetAddForm();
    } catch (e: any) {
      setAddError(e?.message ?? 'Failed to create lead.');
    } finally {
      setAddSaving(false);
    }
  }

  const scopedLeads = useMemo(() => {
    if (currentRole !== 'agent' || !memberId) return leads;
    return leads.filter((l) => l.assignedAgentId === memberId);
  }, [leads, currentRole, memberId]);

  const stats = useMemo(() => {
    const active = scopedLeads.filter((l) => l.status !== 'lost');
    return {
      total: active.length,
      hot: scopedLeads.filter((l) => l.tags.includes('hot') && l.status !== 'lost').length,
      unassigned: active.filter((l) => !l.assignedAgentId).length,
      qualified: scopedLeads.filter((l) => l.status === 'qualified').length,
    };
  }, [scopedLeads]);

  const filtered = useMemo(() => {
    return leads.filter((lead) => {
      if (currentRole === 'agent' && memberId && lead.assignedAgentId !== memberId) return false;

      const q = query.trim().toLowerCase();
      const matchesSearch =
        !q ||
        [lead.fullName, lead.email ?? '', lead.phone ?? '', lead.source ?? '', ...lead.tags]
          .join(' ')
          .toLowerCase()
          .includes(q);

      const matchesFilter =
        filter === 'all'
          ? true
          : filter === 'hot'
          ? lead.tags.includes('hot') && lead.status !== 'lost'
          : lead.status === filter;

      return matchesSearch && matchesFilter;
    });
  }, [leads, query, filter, currentRole, memberId]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const aHot = a.tags.includes('hot') ? 1 : 0;
      const bHot = b.tags.includes('hot') ? 1 : 0;
      if (bHot !== aHot) return bHot - aHot;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [filtered]);

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
      <PageHeader
        title="Leads"
        description="Inbound intake and qualification — move leads through stages, assign agents, and convert to active pipeline."
      />

      {/* ── Stats row ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 28,
        }}
      >
        <StatCard label="Active Leads" value={stats.total} subtext="Excluding archived" />
        <StatCard
          label="Hot Leads"
          value={stats.hot}
          subtext={stats.hot > 0 ? 'Need immediate attention' : 'None flagged hot'}
        />
        <StatCard
          label="Unassigned"
          value={stats.unassigned}
          subtext={stats.unassigned > 0 ? 'Need agent assignment' : 'All assigned'}
        />
        <StatCard
          label="Qualified"
          value={stats.qualified}
          subtext="Ready to convert"
        />
      </div>

      {/* ── Search + filter bar ── */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          marginBottom: 20,
          flexWrap: 'wrap',
        }}
      >
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 260px', minWidth: 200 }}>
          <span
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: 14,
              color: 'var(--r-text-3)',
              pointerEvents: 'none',
            }}
          >
            ⌕
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search leads by name, email, tag..."
            style={{
              width: '100%',
              padding: '10px 14px 10px 34px',
              borderRadius: 10,
              border: '1px solid var(--r-border)',
              background: 'rgba(200,164,92,0.04)',
              color: 'var(--r-text)',
              fontSize: 13,
              outline: 'none',
            }}
          />
        </div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {FILTER_TABS.map(({ key, label }) => {
            const active = filter === key;
            return (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className="r-tab"
                style={{
                  padding: '8px 14px',
                  borderRadius: 9,
                  border: '1px solid var(--r-border)',
                  background: active ? 'var(--r-gold-faint)' : 'rgba(200,164,92,0.04)',
                  color: active ? 'var(--r-gold-bright)' : 'var(--r-text-2)',
                  fontSize: 12,
                  fontWeight: active ? 700 : 500,
                  cursor: 'pointer',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Add Lead button */}
        <button
          onClick={() => setShowAddForm((v) => !v)}
          style={{
            background: showAddForm ? 'var(--r-gold-faint)' : 'rgba(200,164,92,0.06)',
            border: '1px solid var(--r-border)',
            color: 'var(--r-gold-bright)',
            padding: '8px 16px',
            borderRadius: 9,
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            letterSpacing: '0.01em',
          }}
        >
          + Add Lead
        </button>
      </div>

      {/* ── Add Lead inline form ── */}
      {showAddForm && (
        <div
          style={{
            marginBottom: 20,
            borderRadius: 14,
            background: 'var(--r-grad-card)',
            border: '1px solid var(--r-border)',
            boxShadow: 'var(--r-shadow)',
            padding: '18px 20px',
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--r-text)', marginBottom: 14, fontFamily: 'var(--r-font-serif)' }}>
            New Lead
          </div>
          {/* Basic fields */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <FieldLabel>Full Name *</FieldLabel>
              <input
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder="Jane Smith"
                style={inputStyle}
              />
            </div>
            <div>
              <FieldLabel>Email</FieldLabel>
              <input
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                placeholder="jane@example.com"
                type="email"
                style={inputStyle}
              />
            </div>
            <div>
              <FieldLabel>Phone</FieldLabel>
              <input
                value={addPhone}
                onChange={(e) => setAddPhone(e.target.value)}
                placeholder="(555) 000-0000"
                type="tel"
                style={inputStyle}
              />
            </div>
            <div>
              <FieldLabel>Source</FieldLabel>
              <input
                value={addSource}
                onChange={(e) => setAddSource(e.target.value)}
                placeholder="Website, Referral, Social..."
                style={inputStyle}
              />
            </div>
          </div>

          {/* Role + profile fields */}
          <ProfileFormSection
            role={addRole}     setRole={setAddRole}
            buyer={addBuyer}   setBuyer={setAddBuyer}
            seller={addSeller} setSeller={setAddSeller}
          />

          {addError && (
            <div style={{ fontSize: 12, color: 'var(--r-danger)', marginBottom: 10 }}>{addError}</div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <ActionBtn tone="primary" onClick={handleAddLead} disabled={addSaving}>
              {addSaving ? 'Saving…' : 'Save Lead'}
            </ActionBtn>
            <ActionBtn tone="default" onClick={() => { setShowAddForm(false); resetAddForm(); }}>
              Cancel
            </ActionBtn>
          </div>
        </div>
      )}

      {/* ── Lead list ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {sorted.length === 0 ? (
          <div
            style={{
              borderRadius: 16,
              background: 'rgba(200,164,92,0.02)',
              border: '1px solid var(--r-border)',
              padding: '40px 24px',
              textAlign: 'center',
              color: 'var(--r-text-3)',
              fontSize: 14,
            }}
          >
            No leads match your current filter.
          </div>
        ) : (
          sorted.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              agents={agents}
              properties={properties}
              onConvert={handleConvertLead}
              onAssign={assignLeadToAgent}
              onMarkHot={markLeadHot}
              onAddTask={handleAddTask}
              onUpdateStatus={updateLeadStatus}
              onUpdateBuyerProfile={updateBuyerProfile}
              onUpdateSellerProfile={updateSellerProfile}
              onUpdateLead={updateLead}
              onDeleteLead={deleteLead}
            />
          ))
        )}
      </div>

      {/* Cross-links footer */}
      <div
        style={{
          marginTop: 32,
          paddingTop: 20,
          borderTop: '1px solid var(--r-border)',
          display: 'flex',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        {[
          { href: '/contacts', label: '→ View Contacts', desc: 'Converted leads live here' },
          { href: '/opportunities', label: '→ View Pipeline', desc: 'Active deal stages' },
          { href: '/tasks', label: '→ View Tasks', desc: 'Follow-up tasks created from leads' },
        ].map(({ href, label, desc }) => (
          <a
            key={href}
            href={href}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 3,
              padding: '12px 16px',
              borderRadius: 12,
              border: '1px solid var(--r-border)',
              background: 'rgba(200,164,92,0.02)',
              textDecoration: 'none',
              minWidth: 180,
              flex: 1,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--r-gold)' }}>{label}</span>
            <span style={{ fontSize: 11, color: 'var(--r-text-3)' }}>{desc}</span>
          </a>
        ))}
      </div>
    </AppShell>
  );
}
