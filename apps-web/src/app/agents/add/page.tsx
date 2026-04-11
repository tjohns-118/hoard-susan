'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { SectionCard } from '@/components/ui/SectionCard';
import { useAgents } from '@/hooks/useAgents';

type AgentRole = 'broker' | 'agent' | 'admin';

export default function AddAgentPage() {
  const router      = useRouter();
  const { createAgent } = useAgents();

  const [name,  setName]  = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role,  setRole]  = useState<AgentRole>('agent');

  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      setError('Name and email are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createAgent({ name: name.trim(), email: email.trim(), phone: phone.trim() || undefined, role });
      router.push('/settings');
    } catch (err: any) {
      setError(err?.message ?? 'Failed to add agent.');
    } finally {
      setSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 13px',
    borderRadius: 9,
    border: '1px solid var(--r-border)',
    background: 'var(--r-grad-card)',
    color: 'var(--r-text)',
    fontSize: 13,
    fontWeight: 500,
    outline: 'none',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--r-text-3)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginBottom: 6,
  };

  return (
    <AppShell>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <button
          onClick={() => router.back()}
          style={{
            background: 'none', border: 'none', color: 'var(--r-text-3)',
            fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0,
            marginBottom: 12, letterSpacing: '0.02em',
          }}
        >
          ← Back
        </button>
        <h1 style={{
          margin: 0, fontSize: 34, fontWeight: 700, letterSpacing: '-0.01em',
          color: 'var(--r-text)', lineHeight: 1.05, fontFamily: 'var(--r-font-serif)',
        }}>
          Add Agent
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--r-text-3)' }}>
          Invite a new agent to your brokerage workspace.
        </p>
      </div>

      <div style={{ maxWidth: 520 }}>
        <SectionCard title="Agent Details" description="Basic information for the new team member">
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Name */}
            <div>
              <label style={labelStyle}>Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. James Holloway"
                style={inputStyle}
                disabled={saving}
                required
              />
            </div>

            {/* Email */}
            <div>
              <label style={labelStyle}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. james@example.com"
                style={inputStyle}
                disabled={saving}
                required
              />
            </div>

            {/* Phone */}
            <div>
              <label style={labelStyle}>Phone <span style={{ fontWeight: 400, opacity: 0.6 }}>(optional)</span></label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. (512) 555-0100"
                style={inputStyle}
                disabled={saving}
              />
            </div>

            {/* Role */}
            <div>
              <label style={labelStyle}>Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as AgentRole)}
                style={{ ...inputStyle, cursor: 'pointer' }}
                disabled={saving}
              >
                <option value="agent">Agent</option>
                <option value="admin">Admin</option>
                <option value="broker">Broker</option>
              </select>
            </div>

            {/* Error */}
            {error && (
              <div style={{
                padding: '10px 14px', borderRadius: 9,
                background: 'var(--r-danger-bg)', border: '1px solid var(--r-danger-border)',
                color: 'var(--r-danger)', fontSize: 12, fontWeight: 600,
              }}>
                {error}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
              <button
                type="submit"
                disabled={saving}
                className="r-btn-gold"
                style={{
                  padding: '10px 24px', borderRadius: 9, fontSize: 13, fontWeight: 700,
                  border: '1px solid var(--r-border)', background: 'var(--r-gold-faint)',
                  color: 'var(--r-gold-bright)', cursor: saving ? 'default' : 'pointer',
                  opacity: saving ? 0.6 : 1,
                }}
              >
                {saving ? 'Adding…' : 'Add Agent'}
              </button>
              <button
                type="button"
                onClick={() => router.back()}
                disabled={saving}
                style={{
                  padding: '10px 20px', borderRadius: 9, fontSize: 13, fontWeight: 700,
                  border: '1px solid var(--r-border)', background: 'var(--r-grad-card)',
                  color: 'var(--r-text-3)', cursor: saving ? 'default' : 'pointer',
                }}
              >
                Cancel
              </button>
            </div>

          </form>
        </SectionCard>

        {/* Info note */}
        <div style={{
          marginTop: 16, padding: '12px 16px', borderRadius: 10,
          background: 'var(--r-gold-faint)', border: '1px solid var(--r-border)',
          fontSize: 11, color: 'var(--r-text-3)', lineHeight: 1.6,
        }}>
          The agent will be created and added to your brokerage immediately.
          They will receive an invitation email once authentication is configured.
        </div>
      </div>
    </AppShell>
  );
}
