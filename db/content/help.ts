/**
 * Help centre content — the source of truth.
 *
 * Kept as TypeScript rather than written straight into SQLite so that content
 * changes are reviewable in a diff. `pnpm db:seed` compiles this into
 * `data/help.db`, which is what the application reads.
 */

export type Block =
  | { type: 'paragraph'; text: string }
  | { type: 'heading'; text: string }
  | { type: 'list'; ordered?: boolean; items: string[] }
  | { type: 'steps'; items: { title: string; detail: string }[] }
  | { type: 'code'; language?: string; code: string }
  | { type: 'callout'; tone: 'info' | 'warning' | 'danger'; title: string; text: string }
  | { type: 'table'; headers: string[]; rows: string[][] }

export interface HelpCategory {
  id: string
  slug: string
  title: string
  description: string
  icon: string
  position: number
}

export interface HelpArticle {
  id: string
  categoryId: string
  slug: string
  title: string
  summary: string
  body: Block[]
  readMinutes: number
  /** Listed only for viewers holding this permission. */
  permission?: string
  position: number
  updatedAt: string
}

export interface HelpFaq {
  id: string
  question: string
  answer: string
  articleSlug?: string
  position: number
}

export interface HelpChannel {
  id: string
  label: string
  description: string
  href: string
  icon: string
  availability: string
  position: number
}

export const categories: HelpCategory[] = [
  {
    id: 'cat-start', slug: 'getting-started', title: 'Getting started',
    description: 'Connect Jira, invite your team and read your first risk score.',
    icon: 'Rocket', position: 1,
  },
  {
    id: 'cat-integrations', slug: 'integrations', title: 'Integrations',
    description: 'Jira, Slack, Teams and email — connecting them and keeping them healthy.',
    icon: 'Plug', position: 2,
  },
  {
    id: 'cat-access', slug: 'access-control', title: 'Access & permissions',
    description: 'Roles, account approval, workspaces and teams.',
    icon: 'ShieldCheck', position: 3,
  },
  {
    id: 'cat-intelligence', slug: 'release-intelligence', title: 'Release intelligence',
    description: 'How rules score risk and what each dashboard metric means.',
    icon: 'Activity', position: 4,
  },
  {
    id: 'cat-operations', slug: 'operations', title: 'Operations',
    description: 'Sync cadence, scheduled jobs, audit retention and troubleshooting.',
    icon: 'Settings2', position: 5,
  },
]

export const articles: HelpArticle[] = [
  // ─── Getting started ────────────────────────────────────────────────────────
  {
    id: 'art-quickstart', categoryId: 'cat-start', slug: 'quickstart',
    title: 'Set up Silent Signal in ten minutes',
    summary: 'The shortest path from an empty workspace to a populated dashboard.',
    readMinutes: 4, position: 1, updatedAt: '2026-07-20',
    body: [
      { type: 'paragraph', text: 'Silent Signal reads delivery signals out of Jira and scores them against rules you control. Until Jira is connected every dashboard is deliberately empty — the product never invents data.' },
      {
        type: 'steps',
        items: [
          { title: 'Connect Jira', detail: 'Settings → Integrations → Connect Jira. You need integration.write, which Organization Owner and Organization Admin hold by default.' },
          { title: 'Map your custom fields', detail: 'Story points and severity live in Jira custom fields whose ids differ per site. Map them once or those metrics read as empty.' },
          { title: 'Wait for the first sync', detail: 'The first sync pulls history; later runs are incremental and take seconds. The Integrations page shows live progress.' },
          { title: 'Review the default rules', detail: 'Twenty-four rules ship enabled. Rule Management explains what each one scores and how heavily it weighs.' },
          { title: 'Invite your team', detail: 'Members → Invite member. Pick the workspace, team and role up front; the invitee never has to choose them.' },
        ],
      },
      { type: 'callout', tone: 'info', title: 'Nothing is destructive', text: 'Silent Signal only reads from Jira. It never writes to issues, transitions workflows or comments.' },
    ],
  },
  {
    id: 'art-first-risk', categoryId: 'cat-start', slug: 'reading-a-risk-score',
    title: 'Reading a risk score',
    summary: 'What the number means, how it is built and what to do about it.',
    readMinutes: 3, position: 2, updatedAt: '2026-07-18',
    body: [
      { type: 'paragraph', text: 'Every risk score is a weighted sum of rule outcomes. There is no model and no inference — if a score is 82, five rules fired and their weights add to 82. Hovering the score shows exactly which ones.' },
      { type: 'heading', text: 'Bands' },
      {
        type: 'table',
        headers: ['Band', 'Score', 'What it means'],
        rows: [
          ['LOW', '0–39', 'Nothing unusual. No action needed.'],
          ['MEDIUM', '40–69', 'One or two signals worth a look before the next standup.'],
          ['HIGH', '70–100', 'Multiple compounding signals. Treat as a release blocker until reviewed.'],
        ],
      },
      { type: 'callout', tone: 'warning', title: 'A high score is a prompt, not a verdict', text: 'Rules cannot see context you have. Acknowledging a risk records who reviewed it and why, which is what makes the timeline useful later.' },
    ],
  },

  // ─── Integrations ───────────────────────────────────────────────────────────
  {
    id: 'art-jira-connect', categoryId: 'cat-integrations', slug: 'connecting-jira',
    title: 'Connecting Jira Cloud',
    summary: 'API token versus OAuth, and which one your deployment should use.',
    readMinutes: 5, position: 1, updatedAt: '2026-07-24',
    permission: 'integration.read',
    body: [
      { type: 'paragraph', text: 'Two authentication modes are supported. They suit different deployments, and the difference matters for attribution and for multi-tenant use.' },
      { type: 'heading', text: 'API token (Basic auth)' },
      { type: 'paragraph', text: 'A single service account reads on behalf of everyone. Simplest to set up, but the token inherits that user’s permissions and every read is attributed to them.' },
      { type: 'code', language: 'bash', code: 'JIRA_BASE_URL=https://your-org.atlassian.net\nJIRA_EMAIL=integration-bot@your-org.com\nJIRA_API_TOKEN=…' },
      { type: 'callout', tone: 'warning', title: 'Use a dedicated bot account', text: 'If you issue the token from a personal account, that person’s departure silently breaks every sync, and the audit trail attributes all reads to them.' },
      { type: 'heading', text: 'OAuth 2.0 (3LO)' },
      { type: 'paragraph', text: 'Each customer consents to their own Jira site. This is the mode multi-tenant deployments need, and it is what Silent Signal prefers when both are configured.' },
      { type: 'code', language: 'bash', code: 'JIRA_CLIENT_ID=…\nJIRA_CLIENT_SECRET=…\nJIRA_REDIRECT_URI=https://app.example.com/api/integrations/jira/callback' },
      { type: 'callout', tone: 'danger', title: 'Half-filled configuration is rejected', text: 'Setting only some of a mode’s variables raises an error at boot rather than looking connected and failing with a 401 on the first real call.' },
    ],
  },
  {
    id: 'art-field-mapping', categoryId: 'cat-integrations', slug: 'jira-field-mapping',
    title: 'Mapping Jira custom fields',
    summary: 'Why story points read as empty, and how to fix it in one screen.',
    readMinutes: 3, position: 2, updatedAt: '2026-07-24',
    permission: 'integration.read',
    body: [
      { type: 'paragraph', text: 'Story points, sprint and severity are custom fields in Jira, and their ids differ per site. Silent Signal cannot guess them, so they are mapped once per workspace.' },
      {
        type: 'steps',
        items: [
          { title: 'Find the field ids', detail: 'In Jira: Settings → Issues → Custom fields. The id appears in the URL as customfield_XXXXX.' },
          { title: 'Open the mapping dialog', detail: 'Integrations → Jira → Field mapping.' },
          { title: 'Save and re-sync', detail: 'The next sync applies the mapping. Existing records are backfilled on the following full sync.' },
        ],
      },
      {
        type: 'table',
        headers: ['Field', 'Used by', 'If unmapped'],
        rows: [
          ['Story points', 'Sprint velocity, capacity rules', 'Velocity reads zero and capacity rules never fire'],
          ['Sprint', 'Sprint intelligence, scope-change rules', 'Issues do not associate with a sprint'],
          ['Severity', 'Risk scoring, QA triage', 'Every issue is treated as medium severity'],
          ['QA status', 'QA queue', 'Falls back to the workflow status, which is usually correct'],
        ],
      },
    ],
  },
  {
    id: 'art-notifications', categoryId: 'cat-integrations', slug: 'notification-delivery',
    title: 'Slack, Teams and email delivery',
    summary: 'Routing alerts to the right channel with a severity floor and quiet hours.',
    readMinutes: 3, position: 3, updatedAt: '2026-07-22',
    permission: 'notifications.read',
    body: [
      { type: 'paragraph', text: 'A rule that fires produces a notification in the app. Delivery to an external channel is a separate decision, so noisy rules do not automatically become pager traffic.' },
      {
        type: 'list',
        items: [
          'Each route has a severity floor — only alerts at or above it are delivered.',
          'Quiet hours suppress delivery in a local time window; alerts still appear in the app.',
          'Credentials never reach the browser. Delivery happens server-side, always.',
          'Send a test alert after wiring a channel; it confirms the webhook before a real incident does.',
        ],
      },
      { type: 'callout', tone: 'info', title: 'Critical alerts ignore quiet hours only if you say so', text: 'Set the floor to critical on one always-on route rather than disabling quiet hours everywhere.' },
    ],
  },

  // ─── Access & permissions ───────────────────────────────────────────────────
  {
    id: 'art-roles', categoryId: 'cat-access', slug: 'roles-and-permissions',
    title: 'Roles and permissions',
    summary: 'What each role can do, and why roles are only bundles of permissions.',
    readMinutes: 4, position: 1, updatedAt: '2026-07-23',
    body: [
      { type: 'paragraph', text: 'Permissions are the unit of authorization; a role is nothing more than a named bundle of them. No screen checks "is this an admin" — it checks for a permission. That is what lets an organization define its own roles without a product change.' },
      {
        type: 'table',
        headers: ['Role', 'Can do'],
        rows: [
          ['Organization Owner', 'Everything, including billing and SSO'],
          ['Organization Admin', 'People, workspaces, integrations, audit — no billing'],
          ['Release Manager', 'Release readiness, rules, QA queue, notification routing'],
          ['QA Lead', 'QA queue; reads releases, rules and notifications'],
          ['Developer', 'Reads delivery signals; contributes sprint and QA context'],
          ['Viewer', 'Read-only dashboards; no QA queue, no rules'],
        ],
      },
      { type: 'heading', text: 'Who can administer whom' },
      { type: 'paragraph', text: 'A member can only manage roles strictly below their own. An admin cannot demote or remove a peer admin, and the invite dialog never offers a role at or above the inviter’s — the escalation is not blocked at submit time, it is never presented.' },
    ],
  },
  {
    id: 'art-account-status', categoryId: 'cat-access', slug: 'account-approval',
    title: 'Account approval and statuses',
    summary: 'Why a new member sees the whole app with no data in it.',
    readMinutes: 3, position: 2, updatedAt: '2026-07-23',
    body: [
      { type: 'paragraph', text: 'New members arrive through an invitation and land in the pending state. They can sign in and explore every screen they will eventually use, but no data loads — every widget renders as a placeholder with a banner explaining the wait.' },
      { type: 'paragraph', text: 'This is deliberate. Hiding the product until approval makes onboarding feel broken; showing real data before approval would leak it.' },
      {
        type: 'table',
        headers: ['Status', 'Can sign in', 'Sees data'],
        rows: [
          ['Pending', 'Yes', 'No — placeholders only'],
          ['Approved', 'Yes', 'Yes, per their role'],
          ['Suspended', 'Yes', 'No — a single explanation screen'],
          ['Rejected', 'No', '—'],
        ],
      },
      { type: 'callout', tone: 'info', title: 'Approval is immediate', text: 'Permissions activate on the member’s next page load. There is no cache to wait out.' },
    ],
  },
  {
    id: 'art-workspaces', categoryId: 'cat-access', slug: 'workspaces-and-teams',
    title: 'Workspaces and teams',
    summary: 'How the hierarchy maps onto a real delivery organization.',
    readMinutes: 3, position: 3, updatedAt: '2026-07-21',
    body: [
      { type: 'paragraph', text: 'The hierarchy is Organization → Workspace → Team → Member. The organization is the isolation boundary: no data crosses it, ever.' },
      { type: 'code', code: 'Boyner                      (organization)\n├── Production            (workspace)\n│   ├── QA Team           (team)\n│   ├── Backend Team\n│   └── Mobile Team\n└── E-Commerce\n    ├── Web Team\n    └── Mobile Team' },
      {
        type: 'list',
        items: [
          'A workspace usually maps to a delivery domain or a product line.',
          'A team carries ownership: a release manager and a QA lead can be assigned to it.',
          'A member belongs to one organization but can span several workspaces and teams.',
          'Archiving a workspace keeps its history and stops new syncs.',
        ],
      },
    ],
  },

  // ─── Release intelligence ───────────────────────────────────────────────────
  {
    id: 'art-rules', categoryId: 'cat-intelligence', slug: 'how-rules-work',
    title: 'How rules work',
    summary: 'Conditions, weights and why the engine is deliberately not AI.',
    readMinutes: 4, position: 1, updatedAt: '2026-07-19',
    permission: 'rules.read',
    body: [
      { type: 'paragraph', text: 'A rule is a condition and a weight. When the condition holds, the weight is added to the relevant risk score. Every score is therefore explainable down to the rule that produced it — which is the point.' },
      { type: 'code', code: 'IF   qa_wait_days > 5\nAND  issue.severity IN (critical, high)\nTHEN score += 40  label "QA wait over 5 days"' },
      { type: 'heading', text: 'Categories' },
      {
        type: 'list',
        items: [
          'Sprint — velocity drops, mid-sprint scope additions, blocked issues',
          'Release — gate completion, unresolved criticals, days remaining',
          'QA — queue depth, wait time, unassigned items, reopen rate',
          'Capacity — team load against historical throughput',
          'Velocity — trend against the trailing sprint average',
        ],
      },
      { type: 'callout', tone: 'warning', title: 'Pausing beats deleting', text: 'A paused rule keeps its trigger history, so you can see what it would have caught. Deleting discards that.' },
    ],
  },
  {
    id: 'art-metrics', categoryId: 'cat-intelligence', slug: 'dashboard-metrics',
    title: 'What each dashboard metric means',
    summary: 'Formulas and data sources behind the six headline numbers.',
    readMinutes: 3, position: 2, updatedAt: '2026-07-19',
    body: [
      { type: 'paragraph', text: 'Each tile on the dashboard carries an explainer, but the full definitions are collected here.' },
      {
        type: 'table',
        headers: ['Metric', 'Formula', 'Source'],
        rows: [
          ['Release health', 'Weighted risk of open gates, blockers and days remaining', 'Jira releases + gate checklist'],
          ['Sprint health', 'Completed points ÷ committed points, adjusted for scope change', 'Jira board — active sprint'],
          ['QA queue', 'Issues in a QA status, unassigned or still in test', 'Jira issues — QA workflow states'],
          ['Blocked issues', 'Issues flagged Blocked or with an unresolved blocking link', 'Jira issue links and flags'],
          ['Open risks', 'Unacknowledged rule triggers in the last 14 days', 'Rule engine evaluations'],
          ['Active rules', 'Enabled rules evaluated on every sync', 'Rule configuration'],
        ],
      },
    ],
  },

  // ─── Operations ─────────────────────────────────────────────────────────────
  {
    id: 'art-sync', categoryId: 'cat-operations', slug: 'sync-and-scheduled-jobs',
    title: 'Sync cadence and scheduled jobs',
    summary: 'What runs, how often, and what happens when a run overlaps.',
    readMinutes: 4, position: 1, updatedAt: '2026-07-25',
    body: [
      { type: 'paragraph', text: 'Background work runs on a scheduler built into the application — no Redis and no external queue.' },
      {
        type: 'table',
        headers: ['Job', 'Interval', 'Purpose'],
        rows: [
          ['Jira sync', '5 minutes', 'Pull issues changed since the last successful run'],
          ['Rule evaluation', '10 minutes', 'Re-score sprints, releases and QA'],
          ['Notification dispatch', '1 minute', 'Deliver queued alerts to Slack, Teams, email'],
          ['Invitation expiry', '1 hour', 'Expire invitations past their window'],
          ['Audit retention', '24 hours', 'Apply the organization retention policy'],
        ],
      },
      {
        type: 'list',
        items: [
          'A job that is still running is skipped, not queued — a slow sync cannot stack up behind the ticker.',
          'A run only starts once its interval has elapsed, so triggering the scheduler twice runs each job once.',
          'Every run is bounded by a timeout and a retry budget with backoff.',
          'Jobs run sequentially, because running them together would multiply peak load against the same rate-limited Jira tenant.',
        ],
      },
    ],
  },
  {
    id: 'art-troubleshooting', categoryId: 'cat-operations', slug: 'troubleshooting-sync',
    title: 'Troubleshooting a failing sync',
    summary: 'The four failures that account for almost every support ticket.',
    readMinutes: 4, position: 2, updatedAt: '2026-07-25',
    permission: 'integration.read',
    body: [
      { type: 'heading', text: 'Rate limited' },
      { type: 'paragraph', text: 'Jira enforces per-tenant limits and replies with Retry-After. Silent Signal honours it and resumes automatically; the Integrations page shows the window. No action needed unless it repeats every cycle, which usually means another integration is competing for the same budget.' },
      { type: 'heading', text: '401 immediately after connecting' },
      { type: 'paragraph', text: 'Almost always a partially configured credential, or an API token issued by an account that has since lost project access.' },
      { type: 'heading', text: 'Issues sync but story points are empty' },
      { type: 'paragraph', text: 'The custom field mapping is missing. See "Mapping Jira custom fields".' },
      { type: 'heading', text: 'A board is missing' },
      { type: 'paragraph', text: 'The connected account cannot see it. Board visibility follows Jira project permissions — grant the bot account browse access to that project.' },
      { type: 'callout', tone: 'info', title: 'The audit log is the fastest diagnostic', text: 'Integration changes, connection attempts and permission changes are all recorded with the actor and timestamp.' },
    ],
  },
  {
    id: 'art-security', categoryId: 'cat-operations', slug: 'data-and-security',
    title: 'What data is stored and where',
    summary: 'Retention, isolation and what Silent Signal deliberately does not keep.',
    readMinutes: 3, position: 3, updatedAt: '2026-07-25',
    body: [
      {
        type: 'list',
        items: [
          'Issue keys, statuses, timestamps and the mapped fields are stored. Descriptions and comments are not.',
          'Integration credentials are encrypted at rest and never returned by any read endpoint.',
          'Every tenant-scoped record carries an organization id, and isolation is enforced at the database level rather than in application code.',
          'A cross-tenant request returns 404, not 403 — the response must not confirm that a resource exists.',
          'Audit records are kept for the organization’s retention window and then deleted by a scheduled job.',
        ],
      },
      { type: 'callout', tone: 'info', title: 'Silent Signal only reads', text: 'No integration is granted write scope. It cannot transition an issue, comment, or alter a board.' },
    ],
  },
]

export const faqs: HelpFaq[] = [
  {
    id: 'faq-1', position: 1,
    question: 'Why are all my dashboards empty?',
    answer: 'Either Jira is not connected yet, or your account is still pending approval. The banner at the top of the page tells you which.',
    articleSlug: 'quickstart',
  },
  {
    id: 'faq-2', position: 2,
    question: 'How often does data refresh?',
    answer: 'Jira syncs every five minutes and rules re-evaluate every ten. You can force a sync from the Integrations page at any time.',
    articleSlug: 'sync-and-scheduled-jobs',
  },
  {
    id: 'faq-3', position: 3,
    question: 'Can I create my own roles?',
    answer: 'Yes. Roles are bundles of permissions, so a custom role is a set of permission toggles — no product change is required.',
    articleSlug: 'roles-and-permissions',
  },
  {
    id: 'faq-4', position: 4,
    question: 'Someone I invited cannot see anything.',
    answer: 'They are pending. An administrator approves them from Members, and their permissions activate on the next page load.',
    articleSlug: 'account-approval',
  },
  {
    id: 'faq-5', position: 5,
    question: 'Does Silent Signal write to Jira?',
    answer: 'No. Every integration is read-only. It cannot transition issues, comment or change boards.',
    articleSlug: 'data-and-security',
  },
  {
    id: 'faq-6', position: 6,
    question: 'Why is my story point velocity zero?',
    answer: 'The story points custom field is not mapped. Jira custom field ids differ per site, so they are mapped once per workspace.',
    articleSlug: 'jira-field-mapping',
  },
]

export const channels: HelpChannel[] = [
  {
    id: 'ch-support', label: 'Email support', description: 'Technical issues and account questions.',
    href: 'mailto:support@silentsignal.io', icon: 'Mail',
    availability: 'Replies within one business day', position: 1,
  },
  {
    id: 'ch-status', label: 'Status page', description: 'Live availability and incident history.',
    href: 'https://status.silentsignal.io', icon: 'Activity',
    availability: 'Updated in real time', position: 2,
  },
  {
    id: 'ch-security', label: 'Report a security issue', description: 'Disclosure goes straight to the security team.',
    href: 'mailto:security@silentsignal.io', icon: 'ShieldCheck',
    availability: 'Acknowledged within 24 hours', position: 3,
  },
]
