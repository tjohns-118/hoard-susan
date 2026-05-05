'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useRef } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Badge } from '@/components/ui/Badge';
import { useAppStore } from '@/app/store/useAppStore';
import { useSupportTickets } from '@/hooks/useSupportTickets';
import type { SupportTicket, TicketCategory, TicketPriority, TicketStatus } from '@/features/support/types';
import { CATEGORY_LABELS, PRIORITY_LABELS, STATUS_LABELS } from '@/features/support/types';

type Tab = 'ai' | 'report' | 'tickets';
type ReportStep = 'describe' | 'review' | 'success';
type ChatMsg = { role: 'user' | 'assistant'; content: string; error?: boolean };
type BadgeTone = 'default' | 'warning' | 'danger' | 'success' | 'gold';

const SUPPORT_EMAIL = 'support@builtonhoard.com';
const CATEGORY_OPTIONS: TicketCategory[] = ['bug', 'question', 'feature_request', 'billing', 'account_access', 'data_issue', 'other'];
const PRIORITY_OPTIONS: TicketPriority[] = ['low', 'normal', 'high', 'urgent'];

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 13,
  border: '1px solid var(--r-border)', background: 'rgba(200,164,92,0.04)',
  color: 'var(--r-text)', outline: 'none', boxSizing: 'border-box',
};
const labelStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: 'var(--r-text-3)',
  textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5, display: 'block',
};

function statusTone(s: TicketStatus): BadgeTone {
  if (s === 'open')        return 'warning';
  if (s === 'in_progress') return 'gold';
  return 'success';
}
function priorityTone(p: string): BadgeTone {
  if (p === 'urgent' || p === 'high') return 'danger';
  if (p === 'normal')                 return 'warning';
  return 'default';
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── TicketRow (user-facing — no fix brief, no broker controls) ────────────────

function TicketRow({ ticket }: { ticket: SupportTicket }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{ borderRadius: 12, border: '1px solid var(--r-border)', background: 'rgba(200,164,92,0.03)', overflow: 'hidden' }}>
      <div
        onClick={() => setExpanded((v) => !v)}
        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer', userSelect: 'none' }}
      >
        <span style={{ fontSize: 10, color: 'var(--r-text-3)', flexShrink: 0 }}>{expanded ? '▾' : '▸'}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--r-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {ticket.title}
          </div>
          <div style={{ fontSize: 11, color: 'var(--r-text-3)', marginTop: 1 }}>{fmtDate(ticket.createdAt)}</div>
        </div>
        <div style={{ display: 'flex', gap: 5, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Badge tone={statusTone(ticket.status)}>{STATUS_LABELS[ticket.status]}</Badge>
          <Badge tone={priorityTone(ticket.priority)}>{PRIORITY_LABELS[ticket.priority]}</Badge>
          <Badge tone="default">{CATEGORY_LABELS[ticket.category]}</Badge>
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop: '1px solid var(--r-border)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div style={labelStyle}>Your description</div>
            <div style={{ fontSize: 13, color: 'var(--r-text-2)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{ticket.description}</div>
          </div>

          {ticket.pageUrl && (
            <div>
              <div style={labelStyle}>Page</div>
              <span style={{ fontSize: 12, color: 'var(--r-text-3)', wordBreak: 'break-all' }}>{ticket.pageUrl}</span>
            </div>
          )}

          {/* AI-generated response — user-facing only, never fix brief */}
          {ticket.aiSuggestedResponse && (
            <div style={{ borderRadius: 9, border: '1px solid rgba(155,138,180,0.2)', background: 'rgba(155,138,180,0.05)', padding: '11px 14px' }}>
              <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(155,138,180,0.7)', marginBottom: 6 }}>
                Hoard Response
              </div>
              <div style={{ fontSize: 12, color: 'var(--r-text-2)', lineHeight: 1.65 }}>
                {ticket.aiSuggestedResponse}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── AI Chat Section ───────────────────────────────────────────────────────────

const GREETING: ChatMsg = {
  role: 'assistant',
  content: "Hi! I'm Hoard AI. Ask me anything about using the platform — contacts, pipeline, tasks, calendar, messaging, or anything else. For bugs or account issues, use the Report an Issue tab.",
};

function AiChatSection() {
  const [messages, setMessages] = useState<ChatMsg[]>([GREETING]);
  const [input,    setInput]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: ChatMsg = { role: 'user', content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/ai/support-chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          messages: next.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setMessages([...next, { role: 'assistant', content: data.error ?? 'AI is temporarily unavailable. Please try the Report an Issue tab.', error: true }]);
      } else {
        setMessages([...next, { role: 'assistant', content: data.reply }]);
      }
    } catch {
      setMessages([...next, { role: 'assistant', content: 'Something went wrong. Please try again or use the Report an Issue tab.', error: true }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 680, height: 'calc(100vh - 260px)', minHeight: 400 }}>
      {/* Thread */}
      <div style={{
        flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12,
        padding: '4px 0 16px',
      }}>
        {messages.map((msg, i) => (
          <div key={i} style={{
            display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
          }}>
            <div style={{
              maxWidth: '80%', padding: '10px 14px', borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
              fontSize: 13, lineHeight: 1.6,
              background: msg.role === 'user' ? 'var(--r-gold-faint)' : msg.error ? 'var(--r-danger-bg)' : 'rgba(200,164,92,0.05)',
              border: `1px solid ${msg.role === 'user' ? 'var(--r-border)' : msg.error ? 'var(--r-danger-border)' : 'var(--r-border)'}`,
              color: msg.role === 'user' ? 'var(--r-gold-bright)' : msg.error ? 'var(--r-danger)' : 'var(--r-text-2)',
              fontWeight: msg.role === 'user' ? 600 : 400,
            }}>
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{ padding: '10px 14px', borderRadius: '14px 14px 14px 4px', border: '1px solid var(--r-border)', background: 'rgba(200,164,92,0.05)', fontSize: 13, color: 'var(--r-text-3)', fontStyle: 'italic' }}>
              Thinking…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ display: 'flex', gap: 8, paddingTop: 12, borderTop: '1px solid var(--r-border)' }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ask anything about using Hoard… (Enter to send, Shift+Enter for new line)"
          rows={2}
          disabled={loading}
          style={{
            flex: 1, padding: '10px 12px', borderRadius: 9, border: '1px solid var(--r-border)',
            background: 'rgba(200,164,92,0.04)', color: 'var(--r-text)', fontSize: 13,
            lineHeight: 1.5, outline: 'none', resize: 'none', fontFamily: 'inherit',
          }}
        />
        <button
          onClick={send}
          disabled={!input.trim() || loading}
          style={{
            padding: '0 18px', borderRadius: 9, fontSize: 12, fontWeight: 700,
            border: '1px solid var(--r-border)', background: 'var(--r-gold-faint)',
            color: 'var(--r-gold-bright)', cursor: (!input.trim() || loading) ? 'default' : 'pointer',
            opacity: (!input.trim() || loading) ? 0.4 : 1, whiteSpace: 'nowrap',
          }}
        >
          Send
        </button>
      </div>
      <div style={{ fontSize: 10, color: 'var(--r-text-3)', marginTop: 6, paddingLeft: 2 }}>
        Hoard AI only knows general platform guidance — it can't see your data.
      </div>
    </div>
  );
}

// ── Report Issue Section ──────────────────────────────────────────────────────

function ReportIssueSection({ onTicketCreated }: { onTicketCreated: () => void }) {
  const { createTicket } = useSupportTickets(false);

  const [step,        setStep]        = useState<ReportStep>('describe');
  const [rawDesc,     setRawDesc]     = useState('');
  const [analyzing,   setAnalyzing]   = useState(false);
  const [analyzeErr,  setAnalyzeErr]  = useState('');

  // Reviewed / editable fields
  const [aiTitle,    setAiTitle]    = useState('');
  const [aiCategory, setAiCategory] = useState<TicketCategory>('bug');
  const [aiPriority, setAiPriority] = useState<TicketPriority>('normal');
  const [aiSummary,  setAiSummary]  = useState('');
  const [pageUrl,    setPageUrl]    = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitErr,  setSubmitErr]  = useState('');

  // Auto-fill current URL when step opens
  useEffect(() => {
    if (typeof window !== 'undefined') setPageUrl(window.location.href);
  }, []);

  async function analyze() {
    if (rawDesc.trim().length < 10) { setAnalyzeErr('Please describe the issue in a bit more detail.'); return; }
    setAnalyzing(true); setAnalyzeErr('');
    try {
      const res = await fetch('/api/ai/support-pretriage', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ description: rawDesc.trim() }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        // AI unavailable — fall through to manual review with raw description as title
        setAiTitle(rawDesc.trim().slice(0, 80));
        setAiCategory('bug');
        setAiPriority('normal');
        setAiSummary('');
        setAnalyzeErr('');
      } else {
        setAiTitle(data.title    ?? '');
        setAiCategory(data.category ?? 'other');
        setAiPriority(
          data.severity === 'urgent' ? 'urgent' :
          data.severity === 'high'   ? 'high'   :
          data.severity === 'low'    ? 'low'     : 'normal'
        );
        setAiSummary(data.summary ?? '');
      }
      setStep('review');
    } catch {
      setAnalyzeErr('Analysis failed. Please try again or describe the issue manually.');
    } finally {
      setAnalyzing(false);
    }
  }

  async function submit() {
    if (!aiTitle.trim()) { setSubmitErr('Title is required.'); return; }
    setSubmitting(true); setSubmitErr('');
    try {
      await createTicket({
        title:       aiTitle.trim(),
        category:    aiCategory,
        priority:    aiPriority,
        description: rawDesc.trim(),
        pageUrl:     pageUrl.trim() || undefined,
      });
      setStep('success');
      onTicketCreated();
    } catch (err: any) {
      setSubmitErr(err?.message ?? 'Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setStep('describe'); setRawDesc(''); setAiTitle(''); setAiSummary('');
    setAiCategory('bug'); setAiPriority('normal'); setAnalyzeErr(''); setSubmitErr('');
  }

  if (step === 'success') {
    return (
      <div style={{ maxWidth: 540 }}>
        <div style={{ padding: '24px', borderRadius: 16, border: '1px solid var(--r-success-border)', background: 'var(--r-success-bg)' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--r-success)', marginBottom: 8, fontFamily: 'var(--r-font-serif)' }}>Report submitted</div>
          <div style={{ fontSize: 13, color: 'var(--r-success)', lineHeight: 1.6, marginBottom: 16, opacity: 0.85 }}>
            Thanks for letting us know. Our team will review your report and follow up shortly. You can track the status in the My Tickets tab.
          </div>
          <button onClick={reset} style={{ padding: '7px 18px', borderRadius: 8, fontSize: 12, fontWeight: 700, border: '1px solid var(--r-success-border)', background: 'transparent', color: 'var(--r-success)', cursor: 'pointer' }}>
            Report another issue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 580, display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Step indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 24 }}>
        {(['describe', 'review'] as ReportStep[]).map((s, i) => {
          const done   = (s === 'describe' && step === 'review');
          const active = step === s;
          const labels = ['Describe', 'Review & Submit'];
          return (
            <div key={s} style={{ display: 'flex', alignItems: 'center', flex: i === 0 ? 1 : undefined }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 700,
                  background: done || active ? 'var(--r-gold-faint)' : 'transparent',
                  border: done || active ? '1px solid var(--r-border)' : '1px solid rgba(200,164,92,0.15)',
                  color: done || active ? 'var(--r-gold-bright)' : 'var(--r-text-3)',
                }}>
                  {done ? '✓' : i + 1}
                </div>
                <span style={{ fontSize: 11, fontWeight: active ? 700 : 500, color: active ? 'var(--r-gold-bright)' : done ? 'var(--r-text-2)' : 'var(--r-text-3)' }}>
                  {labels[i]}
                </span>
              </div>
              {i === 0 && <div style={{ flex: 1, height: 1, background: step === 'review' ? 'var(--r-border)' : 'rgba(200,164,92,0.12)', margin: '0 10px' }} />}
            </div>
          );
        })}
      </div>

      {/* Step 1: Describe */}
      {step === 'describe' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--r-text)', fontFamily: 'var(--r-font-serif)' }}>
            Describe the issue
          </div>
          <div style={{ fontSize: 13, color: 'var(--r-text-3)', lineHeight: 1.5 }}>
            Write what happened in your own words — our team will review it. Our AI will help structure it into a ticket.
          </div>
          <textarea
            value={rawDesc}
            onChange={(e) => setRawDesc(e.target.value)}
            placeholder="E.g. — I tried to move a contact to a new pipeline stage but the button didn't respond. This started happening after I edited the contact profile."
            rows={7}
            disabled={analyzing}
            style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6, fontSize: 13 }}
          />
          {analyzeErr && (
            <div style={{ fontSize: 12, color: 'var(--r-danger)' }}>{analyzeErr}</div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={analyze}
              disabled={rawDesc.trim().length < 10 || analyzing}
              style={{
                padding: '10px 24px', borderRadius: 9, fontSize: 13, fontWeight: 700,
                border: '1px solid var(--r-border)', background: 'var(--r-gold-faint)',
                color: 'var(--r-gold-bright)', cursor: (rawDesc.trim().length < 10 || analyzing) ? 'default' : 'pointer',
                opacity: (rawDesc.trim().length < 10 || analyzing) ? 0.5 : 1,
              }}
            >
              {analyzing ? 'Analyzing…' : 'Analyze & Continue →'}
            </button>
          </div>
          <div style={{ fontSize: 11, color: 'var(--r-text-3)' }}>
            Our AI will read your description and generate a structured ticket for you to review before submitting.
          </div>
        </div>
      )}

      {/* Step 2: Review */}
      {step === 'review' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--r-text)', fontFamily: 'var(--r-font-serif)' }}>
            Review your report
          </div>

          {aiSummary && (
            <div style={{ padding: '11px 14px', borderRadius: 9, border: '1px solid rgba(155,138,180,0.2)', background: 'rgba(155,138,180,0.05)', fontSize: 12, color: 'var(--r-text-2)', lineHeight: 1.6 }}>
              <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(155,138,180,0.7)', display: 'block', marginBottom: 4 }}>AI Summary</span>
              {aiSummary}
            </div>
          )}

          <div>
            <label style={labelStyle}>Title *</label>
            <input value={aiTitle} onChange={(e) => setAiTitle(e.target.value)} disabled={submitting} style={inputStyle} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Category</label>
              <select value={aiCategory} onChange={(e) => setAiCategory(e.target.value as TicketCategory)} disabled={submitting} style={{ ...inputStyle, cursor: 'pointer' }}>
                {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Priority</label>
              <select value={aiPriority} onChange={(e) => setAiPriority(e.target.value as TicketPriority)} disabled={submitting} style={{ ...inputStyle, cursor: 'pointer' }}>
                {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Page URL</label>
            <input value={pageUrl} onChange={(e) => setPageUrl(e.target.value)} disabled={submitting} style={inputStyle} />
          </div>

          {submitErr && (
            <div style={{ fontSize: 12, color: 'var(--r-danger)', background: 'var(--r-danger-bg)', border: '1px solid var(--r-danger-border)', borderRadius: 8, padding: '8px 12px' }}>
              {submitErr}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { setStep('describe'); setSubmitErr(''); }} disabled={submitting} style={{
              padding: '9px 18px', borderRadius: 9, fontSize: 12, fontWeight: 600,
              border: '1px solid var(--r-border)', background: 'var(--r-grad-card)', color: 'var(--r-text-3)', cursor: 'pointer',
            }}>
              ← Revise
            </button>
            <button onClick={submit} disabled={submitting || !aiTitle.trim()} style={{
              padding: '9px 24px', borderRadius: 9, fontSize: 12, fontWeight: 700,
              border: '1px solid var(--r-border)', background: 'var(--r-gold-faint)',
              color: 'var(--r-gold-bright)', cursor: (submitting || !aiTitle.trim()) ? 'default' : 'pointer',
              opacity: (submitting || !aiTitle.trim()) ? 0.5 : 1,
            }}>
              {submitting ? 'Submitting…' : 'Submit Report'}
            </button>
          </div>
          <div style={{ fontSize: 11, color: 'var(--r-text-3)' }}>
            Our team will review your report and get back to you. You can track progress in My Tickets.
          </div>
        </div>
      )}
    </div>
  );
}

// ── My Tickets Section ────────────────────────────────────────────────────────

function MyTicketsSection() {
  const { tickets, loading } = useSupportTickets(false);
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'all'>('all');

  const filtered = statusFilter === 'all' ? tickets : tickets.filter((t) => t.status === statusFilter);
  const openCount    = tickets.filter((t) => t.status === 'open').length;
  const resolvedCount= tickets.filter((t) => t.status === 'resolved').length;

  return (
    <>
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['all', 'open', 'in_progress', 'resolved'] as const).map((f) => {
            const active = statusFilter === f;
            const label  = f === 'all' ? `All (${tickets.length})` : STATUS_LABELS[f as TicketStatus];
            return (
              <button key={f} onClick={() => setStatusFilter(f)} style={{
                padding: '5px 13px', borderRadius: 7, fontSize: 11, fontWeight: active ? 700 : 500,
                border: '1px solid var(--r-border)',
                background: active ? 'var(--r-gold-faint)' : 'var(--r-grad-card)',
                color: active ? 'var(--r-gold-bright)' : 'var(--r-text-3)', cursor: 'pointer',
              }}>
                {label}
              </button>
            );
          })}
        </div>
        {openCount > 0 && (
          <span style={{ fontSize: 11, color: 'var(--r-text-3)', marginLeft: 4 }}>
            {openCount} open · {resolvedCount} resolved
          </span>
        )}
      </div>

      {loading ? (
        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--r-text-3)', fontSize: 13 }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{ borderRadius: 14, border: '1px dashed var(--r-border)', padding: '48px 32px', textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: 'var(--r-text-3)', marginBottom: 6 }}>
            {statusFilter === 'all' ? 'No tickets yet' : `No ${STATUS_LABELS[statusFilter as TicketStatus].toLowerCase()} tickets`}
          </div>
          <div style={{ fontSize: 12, color: 'var(--r-text-3)', opacity: 0.7 }}>
            {statusFilter === 'all' ? 'Use Report an Issue to get help from the Hoard team.' : 'Try a different filter.'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map((ticket) => <TicketRow key={ticket.id} ticket={ticket} />)}
        </div>
      )}
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SupportPage() {
  const [tab,        setTab]        = useState<Tab>('ai');
  const [ticketsKey, setTicketsKey] = useState(0); // force ticket reload

  // Toast
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  const TABS: { key: Tab; label: string; sub?: string }[] = [
    { key: 'ai',      label: 'Ask Hoard AI', sub: 'Platform guidance' },
    { key: 'report',  label: 'Report an Issue', sub: 'Bugs & problems' },
    { key: 'tickets', label: 'My Tickets', sub: 'Track your reports' },
  ];

  return (
    <AppShell>
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9999, maxWidth: 400,
          padding: '10px 16px', borderRadius: 12,
          background: 'var(--r-success-bg)', border: '1px solid var(--r-success-border)',
          color: 'var(--r-success)', fontSize: 13, fontWeight: 600,
          boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ flex: 1 }}>{toast}</span>
          <button onClick={() => setToast(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 16, padding: 0, opacity: 0.7 }}>×</button>
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 34, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--r-text)', lineHeight: 1.05, fontFamily: 'var(--r-font-serif)' }}>
          Support
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--r-text-3)' }}>
          Get help using Hoard, or report an issue — our team will handle it.
        </p>
      </div>

      {/* Contact strip */}
      <div style={{
        display: 'flex', gap: 20, marginBottom: 28, padding: '13px 18px',
        borderRadius: 11, border: '1px solid var(--r-border)', background: 'rgba(200,164,92,0.03)',
        flexWrap: 'wrap', alignItems: 'center',
      }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--r-text-3)' }}>Need direct help?</span>
        <a href={`mailto:${SUPPORT_EMAIL}`} style={{ fontSize: 12, fontWeight: 600, color: 'var(--r-gold-bright)', textDecoration: 'none' }}>
          {SUPPORT_EMAIL}
        </a>
        <span style={{ fontSize: 11, color: 'var(--r-text-3)', opacity: 0.6 }}>Mon–Fri, 9 am–6 pm CT</span>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
        {TABS.map(({ key, label, sub }) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding: '11px 20px', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
            border: tab === key ? '1px solid var(--r-border)' : '1px solid transparent',
            background: tab === key ? 'var(--r-gold-faint)' : 'rgba(200,164,92,0.03)',
            minWidth: 140,
          }}>
            <div style={{ fontSize: 12, fontWeight: tab === key ? 700 : 600, color: tab === key ? 'var(--r-gold-bright)' : 'var(--r-text-2)', marginBottom: 2 }}>
              {label}
            </div>
            {sub && <div style={{ fontSize: 10, color: 'var(--r-text-3)', fontWeight: 500 }}>{sub}</div>}
          </button>
        ))}
      </div>

      {tab === 'ai'      && <AiChatSection />}
      {tab === 'report'  && (
        <ReportIssueSection
          onTicketCreated={() => {
            showToast("Report submitted — we'll be in touch shortly.");
            setTimeout(() => setTab('tickets'), 1800);
          }}
        />
      )}
      {tab === 'tickets' && <MyTicketsSection key={ticketsKey} />}
    </AppShell>
  );
}
