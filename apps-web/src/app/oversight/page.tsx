'use client';

import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { Badge } from '@/components/ui/Badge';
import { useAppStore } from '@/app/store/useAppStore';

export default function OversightPage() {
  const agents = useAppStore((s) => s.agents);
  const alerts = useAppStore((s) => s.alerts);

  return (
    <AppShell>
      <PageHeader
        title="Oversight"
        description="Broker-level visibility into agents, alerts, and system pressure."
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        <SectionCard title="Agents" description="Assigned brokers">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {agents.map((agent) => (
              <div
                key={agent.id}
                style={{
                  padding: '12px 14px',
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, color: '#fff' }}>{agent.name}</div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 3 }}>
                    {agent.email}
                  </div>
                </div>
                <Badge tone="default">Agent</Badge>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Alerts" description="Needs attention">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {alerts.map((alert) => (
              <div
                key={alert.id}
                style={{
                  padding: '12px 14px',
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 1.4 }}>
                  {alert.message}
                </div>
                <Badge
                  tone={
                    alert.level === 'critical'
                      ? 'danger'
                      : alert.level === 'warning'
                      ? 'warning'
                      : 'default'
                  }
                >
                  {alert.level}
                </Badge>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </AppShell>
  );
}
