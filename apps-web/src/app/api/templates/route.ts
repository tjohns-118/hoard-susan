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
import { getBrokerageId } from '@/lib/getBrokerageId';
import type { TemplateRecord, TemplateCategory } from '@/data/mockDb';

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

  // ── Additional buyer lifecycle ─────────────────────────────────────────────

  {
    name: 'Buyer Welcome — New Client',
    category: 'buyer',
    tags: ['buyer', 'welcome', 'intro'],
    notes: 'Send after signing a buyer representation agreement — sets the tone for the relationship.',
    body: `Hi {{client_name}},

Welcome — I'm genuinely excited to help you find the right home.

Here's what to expect as we get started:
- I'll send curated property matches as they hit the market or come available off-market
- We'll schedule showings at your pace — no pressure
- You'll have my direct line for any questions along the way

The best results come from clear communication. If something isn't quite right, tell me — I'd rather redirect early than show you twenty homes that miss the mark.

Let's find you something worth being excited about.

Best,
{{agent_name}}
{{broker_name}}`,
  },
  {
    name: 'Property Match — You\'ll Want to See This',
    category: 'buyer',
    tags: ['buyer', 'property-match', 'listing'],
    notes: 'Send when a property closely matches a buyer\'s stated criteria.',
    body: `Hi {{client_name}},

A property just came across my desk that I think is worth a look.

{{property_name}}

Based on what you've told me — {{county}} area, your price range, and what you're looking for — this one checks several boxes. I'd rather show it to you quickly than risk it going under contract before you've had a chance to consider it.

Can we schedule a showing in the next day or two? Even a quick drive-by first could be worth it.

Talk soon,
{{agent_name}}`,
  },
  {
    name: 'Offer Submitted — What\'s Next',
    category: 'buyer',
    tags: ['buyer', 'offer', 'update'],
    notes: 'Send immediately after submitting a buyer\'s offer.',
    body: `Hi {{client_name}},

Your offer on {{property_name}} has been submitted. Here's where things stand:

The listing agent typically has 24–48 hours to respond. We may receive:
- An acceptance (let's celebrate)
- A counter-offer (we'll review and respond quickly)
- A rejection (unlikely, but we'll keep momentum)

In the meantime, avoid making any major financial moves — no new credit lines, large purchases, or job changes — as these can affect your financing.

I'll contact you the moment I hear back.

Standing by,
{{agent_name}}`,
  },
  {
    name: 'Inspection Reminder',
    category: 'buyer',
    tags: ['buyer', 'inspection', 'reminder'],
    notes: 'Send 24 hours before an inspection appointment.',
    body: `Hi {{client_name}},

Quick reminder — your inspection for {{property_name}} is scheduled for {{appointment_time}}.

A few things to know:
- Plan for 2–3 hours depending on the size of the home
- You're welcome to attend and ask the inspector questions directly (I recommend it)
- Bring a notepad — inspectors cover a lot and it helps to capture key points

After the inspection, the inspector will provide a written report. We'll review it together and determine next steps — whether that's proceeding as-is, requesting repairs, or negotiating a credit.

See you there,
{{agent_name}}`,
  },
  {
    name: 'Closing Week Checklist — Buyer',
    category: 'buyer',
    tags: ['buyer', 'closing', 'checklist'],
    notes: 'Send one week before a buyer\'s closing date.',
    body: `Hi {{client_name}},

Closing day is almost here — congratulations! Here's a checklist to make sure everything goes smoothly:

Before closing:
- Confirm your wire transfer details directly with the title company (never via email — always call to verify)
- Complete your final walkthrough (we'll schedule this)
- Confirm you have a valid photo ID for the closing table
- Notify your employer, bank, and subscriptions of your new address

On closing day:
- Bring a certified or cashier's check if not wiring funds
- Bring your ID
- Plan for 60–90 minutes at the title office

After closing:
- Change the locks on the new property
- Update your homeowner's insurance to your name
- File the deed with your county if not handled automatically

You're almost there. Let me know if any questions come up before {{close_date}}.

{{agent_name}}`,
  },

  // ── Additional seller lifecycle ────────────────────────────────────────────

  {
    name: 'Listing Prep Checklist',
    category: 'seller',
    tags: ['seller', 'listing', 'prep'],
    notes: 'Send after signing a listing agreement — gives sellers a clear action plan.',
    body: `Hi {{client_name}},

Thank you for trusting me with the sale of {{property_name}}. Here's a preparation checklist to help us present the property in its best light:

Before listing:
- Declutter interior spaces — buyers need to visualize themselves in the home
- Deep clean, including baseboards, windows, and appliances
- Touch up paint in high-traffic areas
- Address any obvious deferred maintenance (dripping faucets, loose hardware, burned-out bulbs)
- Curb appeal: lawn, beds, front door, entry

Documents to locate:
- Survey, deed, and title policy (if available)
- HOA documents and transfer fees (if applicable)
- Utility bills (12 months is ideal)
- Warranties for appliances or recent improvements

I'll coordinate professional photography as soon as we're ready. The goal is to make the listing compelling from the first click.

Questions? I'm always available.

{{agent_name}}`,
  },
  {
    name: 'Showing Feedback Request',
    category: 'seller',
    tags: ['seller', 'showing', 'feedback'],
    notes: 'Send after a showing — keeps seller informed and reinforces your value.',
    body: `Hi {{client_name}},

We had a showing of {{property_name}} earlier today. I'm reaching out to the buyer's agent for their feedback and will share it with you as soon as I hear back.

Buyer feedback — even when it's critical — is valuable data. It tells us how the market perceives the property at the current price and presentation. I'll give you an honest read, not just a filtered version.

If patterns emerge across multiple showings, we'll talk about how to respond — whether that's a staging adjustment, a price conversation, or simply staying the course.

More to come shortly.

{{agent_name}}`,
  },
  {
    name: 'Offer Received — Your Options',
    category: 'seller',
    tags: ['seller', 'offer', 'update'],
    notes: 'Send when an offer is received — clearly lays out the seller\'s options.',
    body: `Hi {{client_name}},

Great news — we've received an offer on {{property_name}}.

I'm reviewing the full terms now and will call you shortly to walk through everything. In general, you have three options:

1. Accept the offer as-is
2. Counter-offer (price, terms, or both)
3. Reject and wait for a stronger offer

Each path has tradeoffs depending on market activity, your timeline, and the offer's terms. I'll give you my honest recommendation, but the decision is always yours.

I'll be in touch within the hour.

{{agent_name}}`,
  },
  {
    name: 'Inspection & Appraisal Update',
    category: 'seller',
    tags: ['seller', 'inspection', 'appraisal', 'update'],
    notes: 'Send after inspection and/or appraisal results are received.',
    body: `Hi {{client_name}},

I have an update on the inspection and appraisal for {{property_name}}.

The buyer's inspector has completed their review and submitted a report to the buyer's agent. I'm reviewing the repair request list now and will share my recommendation on how to respond — what's reasonable to address, what we can negotiate, and what to decline.

On the appraisal side: {{property_name}} has been appraised. I'll walk you through the number and what it means for the transaction.

Let's connect today — I'll have a full picture ready for you.

{{agent_name}}`,
  },
  {
    name: 'Closing Week Checklist — Seller',
    category: 'seller',
    tags: ['seller', 'closing', 'checklist'],
    notes: 'Send one week before a seller\'s closing date.',
    body: `Hi {{client_name}},

You're almost at the finish line on {{property_name}}. Here's what to expect and prepare for this week:

Before closing:
- Complete any agreed-upon repairs (provide receipts if requested)
- Begin moving out or confirm move-out timeline with the buyer's agent
- Cancel or transfer utilities to take effect on closing day
- Return all keys, garage remotes, and any other access items

On closing day:
- Bring a valid photo ID
- Your proceeds will be wired to your account — confirm wire instructions directly with the title company
- Closing typically takes 30–60 minutes for the seller

After closing:
- File your forwarding address with the post office
- Notify your bank, insurance, and subscriptions

Proceeds will typically arrive within 1–2 business days of closing. I'll be at the table with you every step of the way.

{{agent_name}}`,
  },
  {
    name: 'Post-Close — Review & Referral Request',
    category: 'seller',
    tags: ['seller', 'closing', 'review', 'referral'],
    notes: 'Send 1–2 weeks after closing — builds long-term relationship and generates referrals.',
    body: `Hi {{client_name}},

I hope you're settling in well and that the sale of {{property_name}} has closed out smoothly on your end.

It was a genuine pleasure working with you through this process, and I'm proud of the result we achieved together.

If you have a moment, I'd be very grateful if you could leave a brief review — it makes a real difference for clients who are evaluating agents and trying to determine who they can trust.

And if you know anyone — a colleague, neighbor, or friend — who is thinking about buying or selling, I'd be honored to help them the same way I helped you.

Thank you again for putting your trust in me.

Warmly,
{{agent_name}}
{{broker_name}}`,
  },

  // ── Special audience / listing templates ──────────────────────────────────

  {
    name: 'Investor Opportunity Alert',
    category: 'custom',
    tags: ['investor', 'opportunity', 'listing'],
    notes: 'For investor-focused buyers — lead with numbers and ROI potential.',
    body: `Hi {{client_name}},

I wanted to bring a property to your attention before it hits the general market.

{{property_name}} — {{county}}

Key details: {{price}} | {{beds}} beds / {{baths}} baths | {{sqft}} sq ft

From an investment standpoint, this property warrants a look. I can pull comps, rental rate benchmarks, and a rough cap rate estimate before you invest time in a showing.

Interested? Reply or call me and we can review the numbers together.

{{agent_name}}`,
  },
  {
    name: 'Waterfront Property — Featured',
    category: 'custom',
    tags: ['waterfront', 'listing', 'feature'],
    notes: 'For waterfront or lakefront listings — emphasize the lifestyle.',
    body: `Hi {{client_name}},

I have a waterfront property I think is worth your attention.

{{property_name}} — {{county}}
{{price}} | {{beds}} beds | {{baths}} baths

Waterfront properties at this price point don't stay available long in this market. Whether you're looking for a primary residence, a weekend retreat, or an investment, the lifestyle this property offers is genuinely difficult to replicate.

I'd be happy to schedule a showing or share more details. Just say the word.

{{agent_name}}`,
  },
  {
    name: 'Land Listing — Acreage Available',
    category: 'custom',
    tags: ['land', 'acreage', 'listing'],
    notes: 'For raw land or acreage listings — buyers are often developers or lifestyle buyers.',
    body: `Hi {{client_name}},

I wanted to flag a land opportunity that may be of interest.

{{property_name}} — {{county}}
{{price}} | Acreage available

Whether you're looking to build, invest, or simply secure a piece of land in this area, this parcel has strong characteristics worth reviewing. I can share survey details, zoning information, and access specifics.

Land moves differently than homes — when the right parcel comes up in a desirable area, it tends to go quickly. Let me know if you'd like more information.

{{agent_name}}`,
  },
  {
    name: 'Ranch Property — Featured',
    category: 'custom',
    tags: ['ranch', 'listing', 'acreage', 'feature'],
    notes: 'For ranch property listings — emphasize land, improvements, and use cases.',
    body: `Hi {{client_name}},

A ranch property worth your attention has become available.

{{property_name}} — {{county}}
{{price}} | {{beds}} beds / {{baths}} baths | Acreage

This property offers working or lifestyle ranch potential — [describe land features, improvements, water access]. Ranch properties with this profile are increasingly difficult to find in the current market at this price point.

I'm happy to schedule a tour and walk the land with you. These properties are best understood in person.

{{agent_name}}`,
  },
  {
    name: 'Metro Listing — Featured',
    category: 'custom',
    tags: ['metro', 'urban', 'listing', 'feature'],
    notes: 'For urban or metro listings — buyers who value proximity and walkability.',
    body: `Hi {{client_name}},

A property just became available in the area you've been watching.

{{property_name}}
{{price}} | {{beds}} beds / {{baths}} baths | {{sqft}} sq ft

Location-wise, this checks the boxes: [proximity to key areas, walkability, commute access]. At this price point and in this market, well-located inventory doesn't stay available long.

Want to schedule a showing? I can usually make something work within 24–48 hours.

{{agent_name}}`,
  },
  {
    name: 'Luxury Property — Exclusive',
    category: 'custom',
    tags: ['luxury', 'listing', 'feature'],
    notes: 'For luxury listings — focus on quality, exclusivity, and discretion.',
    body: `Hi {{client_name}},

I'm reaching out about a distinguished property that has recently become available.

{{property_name}} — {{county}}
{{price}} | {{beds}} beds / {{baths}} baths | {{sqft}} sq ft

This is the kind of property that rarely comes to market, and when it does, it moves quietly. I wanted to make sure you had the opportunity to consider it before it reaches broader exposure.

I'd be happy to arrange a private showing at your convenience. No pressure — just an opportunity to see what's available at this level.

{{agent_name}}
{{broker_name}}`,
  },
  {
    name: 'Open House Announcement',
    category: 'custom',
    tags: ['open-house', 'listing', 'announcement'],
    notes: 'Announce an open house to your contact list or a targeted audience.',
    body: `Hi {{client_name}},

You're invited to an open house this weekend.

{{property_name}}
{{appointment_time}}

This is a great opportunity to see the property without the pressure of a formal showing. I'll be on-site and happy to answer any questions about the home, the area, or the market in general.

Feel free to bring family or friends — the more eyes, the better the conversation.

Hope to see you there.

{{agent_name}}`,
  },
  {
    name: 'New Listing Alert',
    category: 'custom',
    tags: ['new-listing', 'alert', 'newsletter'],
    notes: 'General new listing announcement — for newsletter or targeted outreach.',
    body: `Hi {{client_name}},

A new listing has just hit the market that I wanted to bring to your attention.

{{property_name}} — {{county}}
Listed at {{price}} | {{beds}} beds / {{baths}} baths | {{sqft}} sq ft

[Brief description of standout features or why this property is worth a look.]

If this sounds like something worth exploring, I'm happy to arrange a showing or share additional details. These tend to move quickly in the current market.

{{agent_name}}`,
  },
  {
    name: 'Price Reduction Alert',
    category: 'custom',
    tags: ['price-drop', 'alert', 'newsletter'],
    notes: 'Notify buyers when a property they may be interested in has had a price reduction.',
    body: `Hi {{client_name}},

I wanted to let you know that {{property_name}} has had a price adjustment.

Previous price: [old price]
New price: {{price}}

If this property was on your radar but the original price gave you pause, now may be the right time to take another look. Price reductions often signal a motivated seller and an opportunity to negotiate on favorable terms.

Let me know if you'd like to schedule a showing or revisit the details.

{{agent_name}}`,
  },
  {
    name: 'Off-Market Access — Early Look',
    category: 'custom',
    tags: ['off-market', 'early-access', 'exclusive'],
    notes: 'For off-market or pre-listing opportunities — conveys exclusivity and urgency.',
    body: `Hi {{client_name}},

I have something that isn't publicly listed yet and I wanted you to see it first.

{{property_name}} — {{county}}
Estimated value: {{price}} | {{beds}} beds / {{baths}} baths

Off-market opportunities like this are rare. The seller is exploring a quiet sale before committing to a full MLS listing. There's no guarantee this reaches the open market — if the right buyer appears, it may close privately.

If this sounds interesting, let's talk soon. These windows close quickly.

{{agent_name}}`,
  },
];

// ── GET /api/templates ────────────────────────────────────────────────────────

export async function GET() {
  const BROKERAGE_ID = await getBrokerageId();
  if (!BROKERAGE_ID) {
    console.error('[/api/templates GET] Brokerage context could not be resolved');
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
  const BROKERAGE_ID = await getBrokerageId();
  if (!BROKERAGE_ID)
    return NextResponse.json({ error: 'Brokerage not configured — set ACTIVE_BROKERAGE_ID or ACTIVE_BROKERAGE_SLUG' }, { status: 503 });

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
  const BROKERAGE_ID = await getBrokerageId();
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
    .eq('brokerage_id', BROKERAGE_ID ?? '');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// ── DELETE /api/templates ─────────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  const BROKERAGE_ID = await getBrokerageId();
  const { id } = await req.json() as { id: string };
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { error } = await supabaseAdmin
    .from('templates')
    .delete()
    .eq('id', id)
    .eq('brokerage_id', BROKERAGE_ID ?? '');

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
