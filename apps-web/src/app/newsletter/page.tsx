'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useMemo } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { StatCard } from '@/components/ui/StatCard';
import { useAppStore } from '@/app/store/useAppStore';
import { useAgents } from '@/hooks/useAgents';

interface NewsletterContact {
  id:               string;
  fullName:         string;
  email:            string;
  phone:            string;
  newsletterTags:   string[];
  kind:             'contact' | 'lead';
  assignedMemberId: string | null;
}

const TAG_COLORS: Record<string, { color: string; bg: string }> = {
  buyers:      { color: '#7ca4cc',           bg: 'rgba(124,164,204,0.12)' },
  sellers:     { color: 'var(--r-gold)',     bg: 'var(--r-gold-faint)' },
  investors:   { color: '#9b8ab4',           bg: 'rgba(155,138,180,0.12)' },
  newsletter:  { color: 'var(--r-text-2)',   bg: 'rgba(200,164,92,0.06)' },
};

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

export default function NewsletterPage() {
  useAgents();
  const agents      = useAppStore((s) => s.agents);
  const currentRole = useAppStore((s) => s.currentRole);

  const [subscribers, setSubscribers] = useState<NewsletterContact[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState('');
  const [filterKind,  setFilterKind]  = useState<'all' | 'contact' | 'lead'>('all');

  useEffect(() => {
    fetch('/api/newsletter', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setSubscribers(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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

  const contacts   = subscribers.filter((s) => s.kind === 'contact').length;
  const leads      = subscribers.filter((s) => s.kind === 'lead').length;
  const withTags   = subscribers.filter((s) => s.newsletterTags.length > 0).length;
  const withEmail  = subscribers.filter((s) => s.email).length;

  return (
    <AppShell>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, fontFamily: 'var(--r-font-serif)', fontSize: 34, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--r-text)', lineHeight: 1.08 }}>
              Newsletter
            </h1>
            <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--r-text-2)' }}>
              {currentRole === 'agent'
                ? 'Your opted-in contacts and leads.'
                : 'Full brokerage newsletter subscriber list.'}
            </p>
          </div>
          {currentRole === 'broker' && (
            <div style={{
              padding: '8px 14px', borderRadius: 9, fontSize: 11, fontWeight: 600,
              background: 'var(--r-gold-faint)', border: '1px solid var(--r-border)',
              color: 'var(--r-text-3)', lineHeight: 1.5,
            }}>
              Broker view — all brokerage subscribers shown
            </div>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 22 }}>
        <StatCard label="Total Subscribers"  value={subscribers.length} subtext="newsletter opt-in" />
        <StatCard label="Contacts"           value={contacts}           subtext="opted in" />
        <StatCard label="Leads"              value={leads}              subtext="opted in" />
        <StatCard label="With Email"         value={withEmail}          subtext={`${withTags} tagged`} />
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, or tag…"
          style={{
            flex: 1, minWidth: 200, padding: '8px 13px', borderRadius: 9,
            border: '1px solid var(--r-border)', background: 'rgba(200,164,92,0.04)',
            color: 'var(--r-text)', fontSize: 12, outline: 'none',
          }}
        />
        {(['all', 'contact', 'lead'] as const).map((k) => (
          <button
            key={k}
            onClick={() => setFilterKind(k)}
            style={{
              padding: '7px 14px', borderRadius: 8, fontSize: 11, fontWeight: filterKind === k ? 700 : 500,
              border: '1px solid var(--r-border)', cursor: 'pointer',
              background: filterKind === k ? 'var(--r-gold-faint)' : 'var(--r-grad-card)',
              color: filterKind === k ? 'var(--r-gold-bright)' : 'var(--r-text-3)',
            }}
          >
            {k === 'all' ? 'All' : k === 'contact' ? 'Contacts' : 'Leads'}
          </button>
        ))}
      </div>

      {/* List */}
      <div style={{ borderRadius: 16, border: '1px solid var(--r-border)', overflow: 'hidden', background: 'var(--r-grad-card)' }}>
        {/* Table header */}
        <div style={{
          display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr auto',
          padding: '10px 18px', borderBottom: '1px solid var(--r-border)',
          background: 'rgba(200,164,92,0.03)',
        }}>
          {['Name', 'Email', 'Type', 'Tags', 'Agent'].map((h) => (
            <span key={h} style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--r-text-3)' }}>
              {h}
            </span>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--r-text-3)', fontSize: 13 }}>
            Loading…
          </div>
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
              <div
                key={sub.id}
                style={{
                  display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr auto',
                  padding: '12px 18px', alignItems: 'center', gap: 8,
                  borderTop: i === 0 ? 'none' : '1px solid var(--r-border)',
                  background: i % 2 === 0 ? 'transparent' : 'rgba(200,164,92,0.015)',
                }}
              >
                {/* Name */}
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--r-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {sub.fullName || '—'}
                </div>

                {/* Email */}
                <div style={{ fontSize: 12, color: 'var(--r-text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {sub.email || <span style={{ color: 'var(--r-text-3)', fontStyle: 'italic' }}>No email</span>}
                </div>

                {/* Kind badge */}
                <span style={{
                  fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em',
                  color: sub.kind === 'lead' ? 'var(--r-gold-bright)' : '#7ca4cc',
                  background: sub.kind === 'lead' ? 'var(--r-gold-faint)' : 'rgba(124,164,204,0.1)',
                  border: '1px solid var(--r-border)', borderRadius: 4, padding: '2px 7px',
                  whiteSpace: 'nowrap', display: 'inline-block',
                }}>
                  {sub.kind}
                </span>

                {/* Tags */}
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {sub.newsletterTags.length > 0
                    ? sub.newsletterTags.map((t) => <TagChip key={t} tag={t} />)
                    : <span style={{ fontSize: 11, color: 'var(--r-text-3)', fontStyle: 'italic' }}>—</span>
                  }
                </div>

                {/* Agent */}
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
          {currentRole === 'agent' && ' · Showing only your assigned contacts'}
        </div>
      )}
    </AppShell>
  );
}
