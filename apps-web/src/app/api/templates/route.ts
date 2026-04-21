/**
 * /api/templates — server-side CRUD for message templates.
 *
 * GET    — fetch all templates for the active brokerage
 * POST   — create a new template
 * PATCH  — update an existing template
 * DELETE — delete a template
 *
 * Uses supabaseAdmin (service role) to bypass RLS.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import type { TemplateRecord, TemplateCategory } from '@/data/mockDb';

const BROKERAGE_ID =
  process.env.ACTIVE_BROKERAGE_ID ?? process.env.NEXT_PUBLIC_ACTIVE_BROKERAGE_ID ?? '';

const VALID_CATEGORIES: TemplateCategory[] = ['buyer', 'seller', 'follow-up', 'deal', 'internal', 'custom'];

// ── Default templates seeded on first load ────────────────────────────────────

const SEED_TEMPLATES: { name: string; category: TemplateCategory; tags: string[]; notes: string; body: string }[] = [
  {
    name: 'New Lead Introduction',
    category: 'follow-up',
    tags: ['intro', 'outreach'],
    notes: 'Use when a new lead comes in — initial touchpoint before the first call.',
    body: `Hi {{client_name}},

My name is {{agent_name}} with {{broker_name}}. Thank you for reaching out — I'd love to learn more about what you're looking for and how I can help.

Could we schedule a quick 15-minute call this week? I'm happy to work around your schedule.

Looking forward to connecting,
{{agent_name}}`,
  },
  {
    name: 'Initial Buyer Follow-Up',
    category: 'buyer',
    tags: ['buyer', 'follow-up', 'intro'],
    notes: 'Send after the first buyer consultation to keep momentum.',
    body: `Hi {{client_name}},

It was great connecting with you earlier. Based on what you shared, I already have a few properties in mind that could be a strong match.

I'll send over a curated shortlist by end of day tomorrow. In the meantime, feel free to share any properties you've been looking at — I can pull the full history and comps on anything that catches your eye.

Best,
{{agent_name}}`,
  },
  {
    name: 'Seller Outreach — First Contact',
    category: 'seller',
    tags: ['seller', 'intro', 'listing'],
    notes: 'First touchpoint for a seller lead — emphasize market knowledge and urgency.',
    body: `Hi {{client_name}},

Thank you for reaching out about listing {{property_name}}. I'd love the opportunity to walk the property and share what I'm seeing in the current market.

Comparable properties in {{county}} have been moving well, and the timing could work in your favor. I've helped several sellers in the area navigate this process smoothly.

Would you be available for a brief walkthrough this week? I can usually accommodate mornings or evenings.

Warmly,
{{agent_name}}
{{broker_name}}`,
  },
  {
    name: 'Appointment Confirmation',
    category: 'follow-up',
    tags: ['confirmation', 'meeting'],
    notes: 'General appointment confirmation — works for consultations and calls.',
    body: `Hi {{client_name}},

Confirming our meeting scheduled for {{appointment_time}}.

We'll be discussing your goals, current market conditions, and the best path forward for you. I'll have relevant data and examples ready to share.

If anything changes or you have questions beforehand, just reach out.

See you then,
{{agent_name}}`,
  },
  {
    name: 'Showing Confirmation',
    category: 'buyer',
    tags: ['buyer', 'showing', 'confirmation'],
    notes: 'Confirm a property showing with practical details.',
    body: `Hi {{client_name}},

Confirming your showing of {{property_name}} on {{appointment_time}}.

Plan for about 30–45 minutes. Feel free to take photos and notes — I'll have current comps and a market summary ready to discuss on site.

If anything comes up, don't hesitate to reach out. Looking forward to seeing you there.

Best,
{{agent_name}}`,
  },
  {
    name: 'Post-Showing Follow-Up',
    category: 'buyer',
    tags: ['buyer', 'post-showing', 'follow-up'],
    notes: 'Send within 2–3 hours of a showing while the property is fresh in their mind.',
    body: `Hi {{client_name}},

Great seeing you at {{property_name}} today. I hope it gave you a clearer sense of what's possible in this range.

I'd love to hear your reaction while it's fresh — what stood out, what didn't, and whether you'd like to revisit it or move on.

Are you free for a quick call tomorrow? Even 10 minutes would be helpful to keep things moving.

Talk soon,
{{agent_name}}`,
  },
  {
    name: 'Buyer Agreement Follow-Up',
    category: 'deal',
    tags: ['buyer', 'agreement', 'document'],
    notes: 'Follow up on an unsigned buyer representation agreement.',
    body: `Hi {{client_name}},

Following up on the Buyer Representation Agreement I sent over. This document formalizes our working relationship and ensures I'm fully committed to representing your interests throughout the process — no cost to you.

It takes about 5 minutes to review and sign. If any clause raises a question, I'm happy to walk through it together.

Looking forward to getting started in earnest.

Best,
{{agent_name}}`,
  },
  {
    name: 'Document Reminder',
    category: 'deal',
    tags: ['document', 'reminder', 'closing'],
    notes: 'Use when documents are outstanding and time-sensitive.',
    body: `Hi {{client_name}},

Just a reminder that we have a few outstanding documents needed to keep your transaction on track. These are time-sensitive and required before we can proceed to the next step.

Please review and return them at your earliest convenience. If anything is unclear or you'd like to go through them together, I'm available by phone or video call.

Thanks for staying on top of this — we're close.

{{agent_name}}`,
  },
  {
    name: 'Under-Contract Update',
    category: 'deal',
    tags: ['under-contract', 'buyer', 'seller', 'update'],
    notes: 'Send immediately after going under contract to set expectations.',
    body: `Hi {{client_name}},

We're officially under contract! Here's a quick overview of what happens next:

Key upcoming milestones:
- Inspection period (next 10 days)
- Appraisal (scheduled by your lender)
- Target closing: {{close_date}}

I'll keep you updated at each milestone. In the meantime, avoid any major financial changes — no new credit lines or large purchases — as this can affect your loan approval.

This is an exciting step. Let me know if you have any questions.

{{agent_name}}`,
  },
  {
    name: 'Price Reduction Conversation',
    category: 'seller',
    tags: ['seller', 'price', 'strategy'],
    notes: 'Approach a pricing conversation with data and empathy — avoid being blunt.',
    body: `Hi {{client_name}},

Thank you for your patience as we've monitored market activity on {{property_name}}. As your agent, my job is to be honest with you about what the data is telling us.

Current days on market: {{days_on_market}}

Buyer feedback and comparable sales suggest that a price adjustment may significantly increase showing activity and overall interest. A modest reduction now can often lead to a stronger net result by shortening time on market.

I've prepared a few scenarios I'd like to walk through with you. Would you be available for a call or meeting this week?

Always in your corner,
{{agent_name}}`,
  },
  {
    name: 'Post-Close Congratulations',
    category: 'follow-up',
    tags: ['closing', 'congratulations', 'relationship'],
    notes: 'Send on the day of closing to celebrate and strengthen the long-term relationship.',
    body: `Hi {{client_name}},

Congratulations — you are officially the new owner of {{property_name}}!

It has been a genuine pleasure working alongside you through this process. Transactions like this are why I love what I do.

A few reminders as you settle in:
- Update your address with the post office, banks, and utilities
- Review your closing documents and file them safely
- Check in on your homeowner's insurance annually

If you ever need a referral, a market update, or just have a question about the property, I'm here. And if you know anyone thinking about buying or selling, I'd be honored to help.

Warmly,
{{agent_name}}
{{broker_name}}`,
  },
  {
    name: '7-Day No Response Follow-Up',
    category: 'follow-up',
    tags: ['re-engage', 'follow-up', 'nurture'],
    notes: 'Use after 7 days of silence — light touch, no pressure.',
    body: `Hi {{client_name}},

I know life gets busy — just wanted to check in and make sure I haven't lost you in the noise.

The market has been active and I've come across a few things that might align with what you mentioned. No pressure at all — I just want to make sure you have what you need when the timing is right for you.

Would a quick call this week work? Even 10 minutes would be helpful.

Best,
{{agent_name}}`,
  },
  {
    name: 'Listing Live — Announcement',
    category: 'seller',
    tags: ['seller', 'listing', 'announcement'],
    notes: 'Notify the seller the moment their listing goes live.',
    body: `Hi {{client_name}},

Great news — {{property_name}} is officially live on the MLS!

Listed at {{price}}, your property is now visible to thousands of buyers and agents across the region. I've also scheduled it for our featured marketing distribution.

Here's what's happening this week:
- Open house coordination (if applicable)
- Targeted digital promotion launch
- Agent network outreach

I'll be in touch with showing feedback as it comes in. Exciting times ahead!

{{agent_name}}`,
  },
  {
    name: 'Re-Engagement — Checking In',
    category: 'follow-up',
    tags: ['re-engage', 'nurture', 'long-term'],
    notes: 'For leads or clients who have gone quiet for 30+ days.',
    body: `Hi {{client_name}},

I hope things have been going well. I was thinking about our earlier conversations and wanted to reach out — have your plans or timeline changed at all?

The market has shifted in some interesting ways recently, and I'd love to catch up and see where things stand for you.

No agenda — just a genuine check-in. Even a 10-minute call would be great to reconnect and make sure I'm still the right resource for you when the time comes.

Looking forward to hearing from you,
{{agent_name}}`,
  },
];

// ── GET /api/templates ────────────────────────────────────────────────────────

export async function GET() {
  if (!BROKERAGE_ID) {
    console.error('[/api/templates GET] ACTIVE_BROKERAGE_ID not set');
    return NextResponse.json([]);
  }

  const { data, error } = await supabaseAdmin
    .from('templates')
    .select('*')
    .eq('brokerage_id', BROKERAGE_ID)
    .order('name', { ascending: true });

  if (error) {
    console.error('[/api/templates GET]', error.message);
    return NextResponse.json([]);
  }

  // Auto-seed any default templates that are not yet in the library (by name).
  // This is idempotent: a partial seed (e.g. 1 existing template) won't block
  // the remaining defaults from being inserted.
  const existingNames = new Set((data ?? []).map((r: any) => r.name as string));
  const missing = SEED_TEMPLATES.filter((t) => !existingNames.has(t.name));
  if (missing.length > 0) {
    const rows = missing.map((t) => ({
      brokerage_id: BROKERAGE_ID,
      name:         t.name,
      category:     t.category,
      body:         t.body,
      tags:         t.tags,
      notes:        t.notes,
    }));
    const { data: seeded, error: seedErr } = await supabaseAdmin
      .from('templates')
      .insert(rows)
      .select();
    if (seedErr) {
      console.error('[/api/templates GET] seed error:', seedErr.message);
    } else {
      console.log(`[/api/templates GET] seeded ${(seeded ?? []).length} missing default templates`);
      // Re-fetch the full library so the response is in sorted order.
      const { data: fresh } = await supabaseAdmin
        .from('templates')
        .select('*')
        .eq('brokerage_id', BROKERAGE_ID)
        .order('name', { ascending: true });
      return NextResponse.json((fresh ?? []).map(mapTemplate));
    }
  }

  return NextResponse.json((data ?? []).map(mapTemplate));
}

// ── POST /api/templates ───────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!BROKERAGE_ID)
    return NextResponse.json({ error: 'ACTIVE_BROKERAGE_ID not set' }, { status: 500 });

  const body = await req.json() as {
    name:      string;
    category:  TemplateCategory;
    body:      string;
    tags?:     string[];
    notes?:    string;
  };

  if (!body.name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('templates')
    .insert({
      brokerage_id: BROKERAGE_ID,
      name:         body.name.trim(),
      category:     VALID_CATEGORIES.includes(body.category) ? body.category : 'custom',
      body:         body.body ?? '',
      tags:         body.tags ?? [],
      notes:        body.notes ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error('[/api/templates POST]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, template: mapTemplate(data) }, { status: 201 });
}

// ── PATCH /api/templates ──────────────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  const body = await req.json() as {
    id:        string;
    name:      string;
    category:  TemplateCategory;
    body:      string;
    tags?:     string[];
    notes?:    string;
  };

  if (!body.id)           return NextResponse.json({ error: 'id required'   }, { status: 400 });
  if (!body.name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 });

  const { error } = await supabaseAdmin
    .from('templates')
    .update({
      name:       body.name.trim(),
      category:   VALID_CATEGORIES.includes(body.category) ? body.category : 'custom',
      body:       body.body ?? '',
      tags:       body.tags ?? [],
      notes:      body.notes ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', body.id)
    .eq('brokerage_id', BROKERAGE_ID);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// ── DELETE /api/templates ─────────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  const { id } = await req.json() as { id: string };
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { error } = await supabaseAdmin
    .from('templates')
    .delete()
    .eq('id', id)
    .eq('brokerage_id', BROKERAGE_ID);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// ── Mapper ────────────────────────────────────────────────────────────────────

function mapTemplate(row: any): TemplateRecord {
  return {
    id:        row.id        as string,
    name:      row.name      as string,
    category:  VALID_CATEGORIES.includes(row.category) ? row.category as TemplateCategory : 'custom',
    body:      row.body      as string,
    tags:      Array.isArray(row.tags) ? row.tags : [],
    notes:     row.notes     ?? undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}
