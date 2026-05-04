'use client';

import { useState, useEffect, useCallback } from 'react';
import type { SupportTicket, TicketStatus, TicketCategory, TicketPriority } from '@/features/support/types';

export type { SupportTicket };

async function fetchTickets(all: boolean): Promise<SupportTicket[]> {
  try {
    const url = all ? '/api/support/tickets?all=true' : '/api/support/tickets';
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export function useSupportTickets(all = false) {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const data = await fetchTickets(all);
    setTickets(data);
    setLoading(false);
  }, [all]);

  useEffect(() => { reload(); }, [reload]);

  async function createTicket(fields: {
    title:          string;
    category:       TicketCategory;
    priority:       TicketPriority;
    description:    string;
    pageUrl?:       string;
    screenshotUrl?: string;
  }): Promise<SupportTicket> {
    const res = await fetch('/api/support/tickets', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(fields),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Failed to create ticket');
    await reload();
    return json.ticket as SupportTicket;
  }

  async function updateStatus(ticketId: string, status: TicketStatus) {
    const res = await fetch('/api/support/tickets', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ action: 'updateStatus', ticketId, status }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Failed to update status');
    await reload();
  }

  return { tickets, loading, reload, createTicket, updateStatus };
}
