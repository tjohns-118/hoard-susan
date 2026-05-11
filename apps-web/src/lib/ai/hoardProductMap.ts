/**
 * Hoard Product Knowledge Map — source of truth for support AI.
 *
 * This file describes every section of the app, how to navigate to it,
 * what it does, and what it does NOT do. The support AI injects this
 * at runtime so it can give accurate, step-by-step guidance.
 *
 * MAINTAINER NOTE: Update this file whenever navigation, feature scope,
 * or role visibility changes. The support AI is only as accurate as this map.
 *
 * Role visibility:
 *   "all"    — visible to both brokers and agents
 *   "broker" — broker-only (hidden from agents)
 *   "admin"  — internal Hoard admin only, never surface to end users
 */

// ── Section descriptor ────────────────────────────────────────────────────────

export interface ProductSection {
  name: string;
  navLabel: string;       // exact text shown in sidebar / bottom nav
  path: string;           // URL path
  roles: 'all' | 'broker' | 'admin';
  summary: string;        // one-sentence description for the AI
  canDo: string[];        // bullet list of what this section DOES
  cannotDo: string[];     // common misconceptions — what it does NOT do
  howTo?: Record<string, string>; // task → click path answer
}

// ── Product sections ──────────────────────────────────────────────────────────

export const PRODUCT_SECTIONS: ProductSection[] = [

  // ── Dashboards ───────────────────────────────────────────────────────────────
  {
    name:     'Dashboard',
    navLabel: 'Home',
    path:     '/',
    roles:    'all',
    summary:  'Landing page. Brokers see a brokerage-wide command view; agents see their personal pipeline focus.',
    canDo: [
      'Broker: view brokerage KPIs (pipeline value, active leads, open deals, conversion rate)',
      'Broker: read AI intelligence briefing and recommended actions',
      'Broker: see agent activity summary, action center, alerts, deal pipeline snapshot',
      'Broker: view lead funnel, task queue, upcoming events, recent activity',
      'Agent: view personal KPIs (my leads, contacts, deals, pipeline, open tasks)',
      'Agent: read AI daily focus briefing',
      'Agent: see action items (hot leads, active negotiations, overdue tasks)',
      'Agent: view my task queue, my leads, my recent activity',
    ],
    cannotDo: [
      'Import contacts or leads — use Imports for that',
      'Edit or create records directly — navigate to the relevant section',
    ],
    howTo: {
      'see pipeline overview': 'Go to Home (sidebar). The KPI strip at the top shows pipeline value, deals, and leads.',
      'see agent performance': 'Go to Home (broker view). Scroll to the Agent Activity section.',
    },
  },

  // ── Leads ────────────────────────────────────────────────────────────────────
  {
    name:     'Leads',
    navLabel: 'Leads',
    path:     '/leads',
    roles:    'all',
    summary:  'Manage and qualify inbound leads before they become contacts or deals.',
    canDo: [
      'View all leads in a filterable list',
      'Create a new lead manually using the + button or the FAB (mobile)',
      'Assign a lead to an agent (broker)',
      'Update lead status: new → contacted → qualified → converted → lost',
      'Tag leads (e.g. "hot") for prioritisation',
      'Add notes to a lead',
      'Convert a lead to a contact or opportunity from the lead detail view',
    ],
    cannotDo: [
      'Bulk-import leads via CSV — use Imports for that',
      'Send mass messages directly from Leads — use Messaging/Templates',
    ],
    howTo: {
      'add a lead': 'Click the + button in the top-right, or tap the gold FAB on mobile, and choose "New Lead".',
      'assign a lead to an agent': 'Open the lead, click the Assigned Agent field, and select an agent from the dropdown.',
      'import leads from CSV': 'Go to Imports in the sidebar. Upload your CSV there — records flow into Leads after import.',
      'convert a lead': 'Open the lead detail view and click "Convert" to turn it into a contact or opportunity.',
    },
  },

  // ── Contacts ─────────────────────────────────────────────────────────────────
  {
    name:     'Contacts',
    navLabel: 'Contacts',
    path:     '/contacts',
    roles:    'all',
    summary:  'CRM contact records — people who have moved past the lead stage or were imported.',
    canDo: [
      'Search and filter contacts by name, phone, email, tags, or assigned agent',
      'View contact details: phone, email, tags, assigned agent, pipeline history',
      'Edit contact details inline',
      'Tag contacts for newsletter groups or prioritisation',
      'Send a direct SMS or email from within a contact record (if messaging is configured)',
      'View linked opportunities for a contact',
      'Create a new contact manually',
    ],
    cannotDo: [
      'Import contacts from a CSV file — use Imports for that (not Contacts)',
      'Send mass/bulk messages directly — use Messaging/Templates',
    ],
    howTo: {
      'find a contact': 'Go to Contacts and use the search bar at the top. Filter by name, phone, or tag.',
      'edit a contact': 'Click a contact row to open their detail view. Fields are editable inline.',
      'import contacts from CSV': 'Go to Imports in the sidebar — NOT Contacts. Upload your CSV file there.',
    },
  },

  // ── IMPORTS (not Contacts) ────────────────────────────────────────────────────
  {
    name:     'Imports',
    navLabel: 'Imports',
    path:     '/imports',
    roles:    'all',
    summary:  'Upload CSV files to bulk-import contacts, leads, or properties into Hoard.',
    canDo: [
      'Upload a CSV file of contacts or leads',
      'Map CSV columns to Hoard fields (name, phone, email, tags, etc.)',
      'Preview and validate data before committing the import',
      'Run the import — records appear in Contacts or Leads after completion',
      'See import results: how many records were inserted, skipped, or failed',
    ],
    cannotDo: [
      'Import directly from Contacts — Imports is its own separate section',
      'Automatically deduplicate all records (duplicates may still appear)',
      'Undo an import — contact support if you need records removed',
    ],
    howTo: {
      'import contacts': 'Go to Imports (sidebar or bottom nav). Click "Upload CSV", select your file, map the columns, then click Run Import. Imported contacts appear in Contacts.',
      'import leads': 'Same as importing contacts — use the Imports section, not the Leads section.',
      'see import results': 'After running an import, the result panel shows how many records were inserted, skipped, or failed.',
    },
  },

  // ── Opportunities / Pipeline ──────────────────────────────────────────────────
  {
    name:     'Opportunities',
    navLabel: 'Pipeline',
    path:     '/opportunities',
    roles:    'all',
    summary:  'Kanban pipeline for tracking active real estate deals through buyer or seller stages.',
    canDo: [
      'View all deals in a Kanban board organised by stage',
      'Create a new opportunity (deal) from a lead or manually',
      'Drag and drop deals between pipeline stages',
      'Set deal value, probability, expected close date, and next steps',
      'Assign deals to agents (broker)',
      'View deal detail: linked contact, stage history, tasks, notes',
      'Mark a deal as closed (won) or lost',
    ],
    cannotDo: [
      'Import deals from CSV — only contacts and leads can be imported',
      'Create a deal without linking it to at least a title/description',
    ],
    howTo: {
      'move a deal to another stage': 'In Pipeline, drag the deal card to the target stage column, or open the deal and change the Stage dropdown.',
      'add a new deal': 'Click the + button or tap the FAB and choose "New Opportunity".',
      'see all deals for an agent': 'Agents see only their own deals. Brokers can filter by agent in Pipeline.',
    },
  },

  // ── Properties / Inventory ────────────────────────────────────────────────────
  {
    name:     'Properties',
    navLabel: 'Properties',
    path:     '/properties',
    roles:    'all',
    summary:  'Manage property listings and inventory, linked to sellers and opportunities.',
    canDo: [
      'Add a property manually with address, price, status, and type',
      'Link a property to a seller contact or opportunity',
      'Update property status: prospect → active → pending → sold',
      'View property inventory summary (active listings, pending, sold)',
      'Match properties to buyer leads (if property matching is enabled)',
    ],
    cannotDo: [
      'Sync listings from MLS automatically (not implemented)',
      'Import properties via CSV (properties must be entered manually)',
    ],
    howTo: {
      'add a property': 'Go to Properties and click the + button. Fill in the address, price, and status.',
      'link a property to a deal': 'Open the opportunity detail and set the Property field to the relevant listing.',
    },
  },

  // ── Messaging / Templates ─────────────────────────────────────────────────────
  {
    name:     'Messaging',
    navLabel: 'Messaging',
    path:     '/messaging',
    roles:    'all',
    summary:  'Send newsletters and templated messages to tagged contact groups via email or SMS.',
    canDo: [
      'Create and manage reusable message templates',
      'Group contacts by tag and send to a tagged group',
      'Send newsletter/campaign-style messages to multiple contacts',
      'View sent message history and delivery status',
      'Use AI to draft message body from context',
      'Send SMS (requires Twilio configured in Settings) or email',
    ],
    cannotDo: [
      'Send individual 1:1 messages from this section — use the contact detail view for that',
      'Import contacts to message — contacts must already be in Hoard',
    ],
    howTo: {
      'send a newsletter': 'Go to Messaging. Choose or create a template, select a tagged contact group, then send.',
      'create a template': 'Go to Messaging → Templates tab. Click New Template and fill in the subject/body.',
      'send to a tagged group': 'Go to Messaging, create or pick a template, then filter recipients by tag.',
    },
  },

  // ── Calendar ──────────────────────────────────────────────────────────────────
  {
    name:     'Calendar',
    navLabel: 'Calendar',
    path:     '/calendar',
    roles:    'all',
    summary:  'Schedule and manage events — showings, closings, calls, meetings, and follow-ups.',
    canDo: [
      'View a calendar of upcoming events',
      'Create events: showing, closing, call, meeting, deadline, follow-up',
      'Link events to a contact, lead, or opportunity',
      'Link events to a property for showings',
      'Agent and client SMS reminders (24h and 2h before event, if enabled)',
    ],
    cannotDo: [
      'Sync with Google Calendar or Outlook (not implemented)',
    ],
    howTo: {
      'schedule a showing': 'Go to Calendar and click on the date/time. Set type to "showing", link the contact and property.',
      'see upcoming events': 'Go to Calendar. Upcoming events also appear on the Home dashboard.',
      'turn on SMS reminders for events': 'SMS event reminders are controlled by admin-level environment settings. Ask your broker if not receiving reminders.',
    },
  },

  // ── Tasks ─────────────────────────────────────────────────────────────────────
  {
    name:     'Tasks',
    navLabel: 'Tasks',
    path:     '/tasks',
    roles:    'all',
    summary:  'Track action items — individually or linked to pipeline deals.',
    canDo: [
      'Create tasks with title, priority (high/medium/low), and due date',
      'Link tasks to an opportunity (deal) for pipeline tracking',
      'Mark tasks complete',
      'Filter by overdue, due today, upcoming',
      'View tasks on the Home dashboard as well',
    ],
    cannotDo: [
      'Assign a task to another agent (tasks are personal)',
    ],
    howTo: {
      'add a task': 'Go to Tasks and click +, or add a task from within an opportunity detail view.',
      'see overdue tasks': 'Go to Tasks and filter by "Overdue". Overdue tasks also show on the Home dashboard.',
    },
  },

  // ── Oversight (broker-only) ───────────────────────────────────────────────────
  {
    name:     'Oversight',
    navLabel: 'Oversight',
    path:     '/oversight',
    roles:    'broker',
    summary:  'Broker-only brokerage health view — pipeline breakdown, agent workload, overdue tasks, wins.',
    canDo: [
      'View brokerage KPIs: pipeline value, closed deals, conversion rate, active leads, inventory, unassigned leads',
      'See pipeline breakdown by stage with deal counts and values',
      'See alert board: urgent pipeline issues',
      'View per-agent workload: deal count, lead count, pipeline value, overdue tasks',
      'See overdue tasks across the whole brokerage',
      'See recent wins (closed deals in last 30 days)',
      'View property inventory summary',
    ],
    cannotDo: [
      'Edit records from Oversight — navigate to the relevant section to make changes',
    ],
    howTo: {
      'see agent workload': 'Go to Oversight (broker-only). Scroll to the Agent Workload section.',
      'see pipeline health': 'Go to Oversight. The KPI strip and Pipeline Breakdown panel show brokerage-wide deal health.',
    },
  },

  // ── Agents (broker-only) ─────────────────────────────────────────────────────
  {
    name:     'Agents',
    navLabel: 'Agents',
    path:     '/agents',
    roles:    'broker',
    summary:  'Broker-only team management view — agent roster, invite, and workload.',
    canDo: [
      'View agent roster',
      'Invite a new agent to the brokerage by email',
      'View per-agent pipeline summary',
      'Deactivate an agent',
    ],
    cannotDo: [
      'Change agent billing directly — managed in Settings → Billing',
    ],
    howTo: {
      'invite an agent': 'Go to Agents (broker view) and click Invite Agent. Enter their email address.',
      'see an agent\'s pipeline': 'Go to Agents, click an agent row to see their deals, leads, and tasks.',
    },
  },

  // ── Settings ──────────────────────────────────────────────────────────────────
  {
    name:     'Settings',
    navLabel: 'Settings',
    path:     '/settings',
    roles:    'all',
    summary:  'Account settings: profile, SMS phone number, billing, team, appearance, and support contact.',
    canDo: [
      'Update profile: name, email',
      'Set or update your SMS phone number for automated reminders (Profile & SMS section)',
      'Enable/disable SMS reminders for your account',
      'Broker: manage billing and subscription via the Billing section (Stripe portal)',
      'Broker: view per-agent billing (billed per active agent)',
      'Broker: configure SMS/Twilio credentials',
      'Broker: invite and manage team members',
      'Change appearance (light/dark mode if available)',
      'Find Hoard support contact details',
    ],
    cannotDo: [
      'Agents cannot access billing settings — only brokers can',
    ],
    howTo: {
      'change phone number': 'Go to Settings → Profile & SMS. Update your phone number and save.',
      'enable SMS reminders': 'Go to Settings → Profile & SMS. Toggle SMS Reminders on.',
      'manage billing': 'Go to Settings → Billing (broker only). Click "Open Billing Portal" to manage via Stripe.',
      'invite a team member': 'Go to Settings → Team or go to Agents (broker view).',
    },
  },

  // ── Support ───────────────────────────────────────────────────────────────────
  {
    name:     'Support',
    navLabel: 'Support',
    path:     '/support',
    roles:    'all',
    summary:  'Get help using Hoard or report a software issue.',
    canDo: [
      'Ask the AI assistant how to use any Hoard feature',
      'File a support ticket / report a bug using the "Report an Issue" tab',
      'View previously submitted tickets',
    ],
    cannotDo: [
      'Resolve brokerage operational issues (wrong data, deals gone missing) — use Report an Issue for those',
      'Get legal or financial advice',
    ],
    howTo: {
      'file a bug report': 'Go to Support → Report an Issue tab. Describe the problem and submit.',
      'get help using a feature': 'Ask this chat assistant. For unresolved issues, email support@use-hoard.com.',
    },
  },

  // ── Admin (internal only) ─────────────────────────────────────────────────────
  {
    name:     'Admin',
    navLabel: 'Admin',
    path:     '/admin',
    roles:    'admin',
    summary:  'Internal Hoard admin panel — not visible to brokers or agents.',
    canDo: [
      'View all brokerages and users (Hoard staff only)',
      'Manage support tickets across all brokerages',
      'View usage metrics',
    ],
    cannotDo: [],
    howTo: {},
  },

];

// ── Role-filtered view ────────────────────────────────────────────────────────

export function getSectionsForRole(role: 'broker' | 'agent' | 'admin'): ProductSection[] {
  if (role === 'admin') return PRODUCT_SECTIONS;
  if (role === 'broker') return PRODUCT_SECTIONS.filter((s) => s.roles !== 'admin');
  return PRODUCT_SECTIONS.filter((s) => s.roles === 'all');
}

// ── Support AI knowledge block ────────────────────────────────────────────────
// Rendered as a compact text block to inject into the support AI system prompt.

export function buildProductKnowledgeBlock(role: 'broker' | 'agent' | 'admin'): string {
  const sections = getSectionsForRole(role);

  const lines: string[] = [
    '=== HOARD PRODUCT MAP (source of truth — use only this, not prior training data) ===',
    '',
    'Navigation lives in the sidebar on desktop and the bottom nav on mobile.',
    '',
  ];

  for (const s of sections) {
    if (s.roles === 'admin' && role !== 'admin') continue;

    lines.push(`## ${s.name} (nav: "${s.navLabel}", path: ${s.path})`);
    lines.push(`What it is: ${s.summary}`);

    if (s.canDo.length > 0) {
      lines.push('Can do: ' + s.canDo.join(' | '));
    }
    if (s.cannotDo.length > 0) {
      lines.push('Cannot do / common misconceptions: ' + s.cannotDo.join(' | '));
    }
    if (s.howTo && Object.keys(s.howTo).length > 0) {
      lines.push('How-to answers:');
      for (const [task, answer] of Object.entries(s.howTo)) {
        lines.push(`  • "${task}" → ${answer}`);
      }
    }
    lines.push('');
  }

  lines.push('=== END PRODUCT MAP ===');
  return lines.join('\n');
}

// ── Test vectors ──────────────────────────────────────────────────────────────
// These are reference Q&A pairs for manual or automated verification.
// They describe what the support AI SHOULD answer for common questions.
// Run: npx tsx src/lib/ai/hoardProductMap.test.ts (if added to CI)

export const SUPPORT_TEST_VECTORS: { question: string; expectedSection: string; mustMention: string[] }[] = [
  {
    question: 'How do I import contacts?',
    expectedSection: 'Imports',
    mustMention: ['Imports', 'sidebar', 'CSV'],
  },
  {
    question: 'Where do I change my phone number?',
    expectedSection: 'Settings',
    mustMention: ['Settings', 'Profile'],
  },
  {
    question: 'How do I manage billing?',
    expectedSection: 'Settings',
    mustMention: ['Settings', 'Billing'],
  },
  {
    question: 'Where do I send newsletters?',
    expectedSection: 'Messaging',
    mustMention: ['Messaging'],
  },
  {
    question: 'How do I see agent workload?',
    expectedSection: 'Oversight',
    mustMention: ['Oversight'],
  },
  {
    question: 'How do I add a lead?',
    expectedSection: 'Leads',
    mustMention: ['Leads', '+'],
  },
  {
    question: 'How do I file a bug report?',
    expectedSection: 'Support',
    mustMention: ['Support', 'Report an Issue'],
  },
  {
    question: 'How do I schedule a showing?',
    expectedSection: 'Calendar',
    mustMention: ['Calendar'],
  },
  {
    question: 'Where are my overdue tasks?',
    expectedSection: 'Tasks',
    mustMention: ['Tasks'],
  },
  {
    question: 'How do I move a deal to a different stage?',
    expectedSection: 'Opportunities',
    mustMention: ['Pipeline'],
  },
];
