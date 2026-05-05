/**
 * GET /api/admin/insurance
 *
 * Returns active opportunities at stages where insurance should be discussed.
 * Read-only. Admin access required.
 *
 * Insurance-relevant stages (buyer + seller pipelines):
 *   offer_prepared, offer_submitted, offer_received, negotiating,
 *   under_contract, inspections, repair_negotiation, appraisal, clear_to_close
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { getBrokerageId } from '@/lib/getBrokerageId';
import { getSessionUser } from '@/lib/getSessionUser';
import { getMembership } from '@/lib/getMembership';
import { isAdminEmail } from '@/app/api/admin/check/route';

async function checkAdmin(): Promise<boolean> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return false;
  if (isAdminEmail(sessionUser.email)) return true;
  try {
    const m = await getMembership(sessionUser.id, sessionUser.email);
    if (m?.role === 'admin') return true;
  } catch {}
  return false;
}

const INSURANCE_STAGES = [
  'offer_prepared',
  'offer_submitted',
  'offer_received',
  'negotiating',
  'under_contract',
  'inspections',
  'repair_negotiation',
  'appraisal',
  'clear_to_close',
];

const STAGE_LABELS: Record<string, string> = {
  offer_prepared:    'Offer Prepared',
  offer_submitted:   'Offer Submitted',
  offer_received:    'Offer Received',
  negotiating:       'Negotiating',
  under_contract:    'Under Contract',
  inspections:       'Inspections',
  repair_negotiation:'Repair Negotiation',
  appraisal:         'Appraisal',
  clear_to_close:    'Clear to Close',
};

const STAGE_URGENCY: Record<string, 'high' | 'normal'> = {
  under_contract:    'high',
  inspections:       'high',
  appraisal:         'high',
  clear_to_close:    'high',
  repair_negotiation:'normal',
  negotiating:       'normal',
  offer_prepared:    'normal',
  offer_submitted:   'normal',
  offer_received:    'normal',
};

export async function GET() {
  if (!(await checkAdmin()))
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  const BROKERAGE_ID = await getBrokerageId();
  if (!BROKERAGE_ID)
    return NextResponse.json({ error: 'Brokerage not configured' }, { status: 503 });

  const { data, error } = await supabaseAdmin
    .from('opportunities')
    .select('id, contact_name, property_address, value, stage, pipeline_type, assigned_agent_id, expected_close_date')
    .eq('brokerage_id', BROKERAGE_ID)
    .in('stage', INSURANCE_STAGES)
    .order('value', { ascending: false });

  if (error) {
    console.error('[GET /api/admin/insurance]', error.message);
    return NextResponse.json([]);
  }

  // Fetch agent names for display
  const agentIds = [...new Set((data ?? []).map((o: any) => o.assigned_agent_id).filter(Boolean))];
  const agentMap: Record<string, string> = {};

  if (agentIds.length) {
    const { data: members } = await supabaseAdmin
      .from('brokerage_members')
      .select('id, name')
      .in('id', agentIds);

    for (const m of members ?? []) agentMap[m.id] = m.name ?? '—';
  }

  const result = (data ?? []).map((o: any) => ({
    id:               String(o.id),
    contactName:      o.contact_name       ?? '—',
    propertyAddress:  o.property_address   ?? null,
    value:            Number(o.value)      || 0,
    stage:            o.stage              ?? '',
    stageLabel:       STAGE_LABELS[o.stage] ?? o.stage,
    urgency:          STAGE_URGENCY[o.stage] ?? 'normal',
    pipelineType:     o.pipeline_type      ?? 'buyer',
    agentName:        agentMap[o.assigned_agent_id] ?? '—',
    expectedCloseDate:o.expected_close_date ?? null,
  }));

  return NextResponse.json(result);
}
