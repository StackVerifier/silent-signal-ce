# Silent Signal Technical Audit Report

_Date: 2026-07-25 · Scope: full frontend application (`app/`, `components/`, `lib/`, `store/`, `hooks/`) · Commit `1f5e8da`_

---

## Executive Summary

Silent Signal is a well-designed **UI prototype**, not yet an enterprise SaaS application. The visual system is coherent, the information architecture is sensible, and the domain model in `lib/types.ts` is genuinely good. What is missing is nearly everything between the pixels and the product: no data layer, no auth enforcement, no state contract, no accessibility, no build safety.

Ten findings that matter most:

1. **Authentication is decorative.** `AuthProvider` is mounted only in `app/auth/layout.tsx`. Every dashboard and settings route renders with no session check, no middleware, no redirect. `lib/auth-context.tsx` mints a token client-side and hardcodes `role: 'admin'` for any email/password. Anyone who reaches the URL is an admin.
2. **No data/service layer.** Components import `lib/mock-data.ts` directly at module scope (e.g. `executive-dashboard.tsx` imports 6 datasets). There is no seam to swap in Jira/Slack. Adding real APIs today means editing every component.
3. **Build-time type safety is disabled.** `next.config.mjs` sets `typescript.ignoreBuildErrors: true`. There is a `lint` script but no ESLint config and no ESLint dependency — `pnpm lint` fails. Nothing gates a broken build.
4. **Zero loading / error / retry states.** No `loading.tsx`, `error.tsx`, `not-found.tsx`, or error boundary anywhere. The only empty state is `EmptyState({ message })` — a gray sentence with no CTA. With real APIs this becomes a blank-screen product.
5. **Everything is a client component.** 22 of 24 `.tsx` files start with `'use client'`, including all six dashboard pages. React Server Components, streaming and server-side data fetching are all forfeited, and Framer Motion ships on every route.
6. **The sidebar is desktop-only.** It is a flex sibling with a fixed 220px width and no breakpoint handling — on a 390px viewport it consumes 56% of the screen. There is no mobile drawer. It also `return null`s until mounted, which causes a visible layout shift on every load.
7. **Three competing sources of truth for state.** Zustand store (`store/dashboard-store.ts`), React Context (`lib/auth-context.tsx`), and direct module imports of mock data. The store holds a copy of data that components never read. Store consumers destructure the whole store, so every 30s poll re-renders all subscribers.
8. **Navigation is defined three times.** `sidebar.tsx` (`navItems`), `command-palette.tsx` (`commands`), and `use-keyboard-shortcuts.ts` (`PAGE_SHORTCUTS`) each maintain their own route list. They are already out of sync — the palette is missing 8 of 14 routes.
9. **Accessibility is effectively absent.** Zero `aria-*` or `role` attributes across all eight dashboard components. Status is encoded by color alone. `aria-current` is missing on active nav. The command palette has no focus trap, no `role="dialog"`, and doesn't restore focus.
10. **`images.unoptimized: true`** disables Vercel's image pipeline, and the design tokens defined in `globals.css` are unused — every component hardcodes hex values (`#151D32`, `#1E2D4A`, …), making theming or white-labeling a find-and-replace across ~5,400 lines.

**Overall readiness:** design/UX ~70%, engineering foundation ~25%, enterprise readiness ~10%.

---

## Critical Issues

| # | Issue | Impact | Priority | Recommended solution |
|---|---|---|---|---|
| 1 | No route protection; `AuthProvider` scoped to `/auth` only | Any visitor gets full admin UI; RBAC unenforceable | **P0** | `middleware.ts` guarding `(dashboard)`/`(settings)`; move `AuthProvider` to root layout; server-side session read |
| 2 | Session token in `localStorage`, minted client-side | XSS = full account takeover; no revocation, no expiry check | **P0** | httpOnly + `Secure` + `SameSite=Lax` cookie, server-issued; adopt Auth.js/Clerk/WorkOS |
| 3 | `canAccess()` uses `require('./types')` inside a client component | CommonJS `require` in an ESM/bundler context — breaks or bloats the bundle | **P0** | Static import; delegate to `lib/permissions.hasPermission` (already exists, unused here) |
| 4 | `ignoreBuildErrors: true`; no ESLint config despite `lint` script | Type errors ship to production silently; `pnpm lint` exits non-zero | **P0** | Remove the flag, fix fallout, add `eslint` + `eslint-config-next`, wire into CI |
| 5 | Mock data imported directly by components | Jira/Slack integration requires rewriting every page | **P0** | `services/` layer + TanStack Query; components consume hooks only |
| 6 | No loading/error/empty/retry states | Real network = blank screens, no recovery path | **P0** | Skeletons, `error.tsx` + boundaries with Retry, actionable empty states |
| 7 | No mobile navigation | Product unusable below ~1024px | **P1** | Off-canvas drawer < `lg`, fixed rail ≥ `lg` |
| 8 | Client-only rendering of all pages | Poor TTFB/LCP, larger bundles, no streaming | **P1** | Server Components for pages; `'use client'` only on interactive leaves |
| 9 | No `aria-*`/roles; color-only status | Fails WCAG 2.1 AA; blocks enterprise procurement | **P1** | Landmarks, `aria-current`, dialog semantics, text/icon alongside color |
| 10 | Navigation defined in 3 places | Routes silently drift; palette already incomplete | **P1** | Single `lib/navigation.ts` consumed by sidebar, palette and shortcuts |
| 11 | Store subscriptions without selectors | Every 30s poll re-renders all subscribers | **P2** | `useDashboardStore(s => s.metrics)` selector form |
| 12 | Duplicate `(dashboard)` / `(settings)` layouts (byte-identical) | Divergence risk | **P2** | One shared `AppShell` component |
| 13 | `images.unoptimized: true`; `shadcn` CLI as a runtime dependency | Larger images; CLI in the production dependency graph | **P2** | Remove flag; move `shadcn` to `devDependencies` |
| 14 | `/auth/register` linked but does not exist | 404 from the login page | **P2** | Build register/forgot-password or remove the link |
| 15 | No "Teams" page despite being a named main page | Spec gap — only `Members` exists | **P2** | Add `/teams` (team → members → projects mapping) |

---

## Phase 1 — Project Analysis

### Framework

| Aspect | Finding |
|---|---|
| Framework | Next.js **16.2.6**, React **19**, App Router (route groups `(dashboard)`, `(settings)`) |
| Language | TypeScript 5.7.3, `strict: true` — but `target: ES6` (outdated; use `ES2022`) and build errors ignored |
| Styling | Tailwind CSS v4 (CSS-first `@theme inline`), tokens declared in `globals.css` **but unused by components** |
| UI kit | shadcn (`base-nova` style) on `@base-ui/react`. Only **one** primitive exists: `components/ui/button.tsx` — and it is used almost nowhere; pages hand-roll `<button className="px-4 py-2 bg-[#6C63FF] …">` |
| Animation | Framer Motion 12, imported in ~20 files, including on every page shell |
| Icons | lucide-react (tree-shakeable; sidebar aliases `Bell as BellIcon`, `Zap as IntegrationIcon` unnecessarily) |
| Build | Default Next build. No bundle analyzer, no CI, no tests, no `.env.example` |

### Folder Architecture

```
app/            routes only — thin page shells (13 lines each) ✅
components/
  dashboard/    7 page-level "feature" components (200–480 lines each) ⚠️
  layout/       sidebar, topbar, command palette, keyboard provider ✅
  settings/     one header component
  ui/           only button.tsx ❌
hooks/          one hook ❌
lib/            types, mock-data, permissions, utils, auth-context (misplaced) ⚠️
store/          one zustand store ⚠️
```

**Missing entirely:** `services/`, `app/api/`, `middleware.ts`, `features/`, `components/ui/*` (card, table, dialog, input, badge, skeleton, toast), `providers/`, tests, `.env.example`.

The naming is inconsistent: `components/dashboard/` actually contains *feature pages* (Rule Management, QA Queue) that have nothing to do with the Dashboard route. Recommended target:

```
features/
  dashboard/  { components/, hooks/, api/ }
  sprint/     …
  rules/      …
services/     jira.service.ts, release.service.ts, notification.service.ts
components/ui/   design-system primitives
lib/          pure helpers, types, config
```

### Dependency Analysis

| Package | Verdict |
|---|---|
| `shadcn@^4.8.0` | ❌ CLI listed in `dependencies` — move to `devDependencies` |
| `framer-motion@^12` | ⚠️ ~55KB gz, imported everywhere. Use `motion/react` `LazyMotion` + `m`, or CSS animations for the simple fade-ups (most usages are `initial/animate` fades that CSS handles) |
| `tw-animate-css` | ⚠️ Barely used alongside hand-written keyframes in `globals.css` — duplicated animation strategy |
| `zustand@^5` | ✅ Fine, but underused (holds unread data) |
| `@vercel/analytics` | ✅ Correctly gated to production |
| `@base-ui/react` | ⚠️ Only `Button` consumed — either adopt properly (Dialog, Popover, Select) or drop |
| ESLint | ❌ Absent yet scripted |
| Testing | ❌ No Vitest/Playwright/Testing Library |
| `pnpm.overrides.hono@4.12.25` | ⚠️ Pinning a transitive dep with no direct usage — leftover; verify and remove |

No known-vulnerable packages, but there is also no `pnpm audit` / Dependabot in CI.

---

## Phase 2 — UX Improvements

### Sidebar (the reported scrollbar issue)

**Root cause:** `nav` uses `overflow-y-auto` unconditionally (`sidebar.tsx:119`), and `globals.css` styles `::-webkit-scrollbar` globally to a visible 4px `#1E2D4A` track. Firefox gets the OS default scrollbar because `scrollbar-width` is never set. With 14 items at 220px width the nav overflows around 800px viewport height, so the bar is visible on most laptops.

Additional sidebar defects:

- `if (!mounted) return null` (line 57) — sidebar is absent on first paint, causing a full-width→220px content jump (CLS) and no SSR HTML for nav links.
- `motion.aside` animates `width` → layout thrash on every collapse; `transform` or a CSS `width` transition on a grid column is cheaper.
- `collapsed` state is not persisted (resets every navigation-free reload) and is not shared with the topbar.
- `isActive('/')` uses `startsWith` for all other routes — `/release` would also match a future `/release-notes`.
- No `aria-current="page"`, no `<nav aria-label>`, no skip link.
- Badges (`42`, `18`, `24`) are hardcoded strings, not derived from data.
- Keyboard shortcut hints (`1`–`6`) are `opacity-0` until hover — invisible to keyboard-only users.
- Sections are labeled `Monitoring / Admin / Settings`, but `Notifications` and `Integrations` are filed under `core`, so they appear under "Monitoring". Grouping should be: **Monitoring** (Dashboard, Sprint, Release, QA Queue, Risk Timeline, Rules) · **Workspace** (Teams, Members, Integrations, Notifications) · **Admin** (Audit Log, Billing, Workspace) · footer (Profile, Help).

**Recommended sidebar contract**

```
Desktop (≥1024px)   fixed rail, 220px / 64px collapsed, persisted in localStorage,
                    nav scrolls only when it overflows, scrollbar hidden until hover
Tablet  (768–1023)  collapsed icon rail by default, tooltips on hover
Mobile  (<768px)    off-canvas drawer, overlay + swipe/ESC close, focus trap,
                    44px touch targets, body scroll lock
```

Concrete CSS fix for the scrollbar:

```css
.nav-scroll { scrollbar-width: thin; scrollbar-color: transparent transparent; }
.nav-scroll::-webkit-scrollbar-thumb { background: transparent; }
.nav-scroll:hover { scrollbar-color: #1E2D4A transparent; }
.nav-scroll:hover::-webkit-scrollbar-thumb { background: #1E2D4A; }
```

…scoped to the nav rather than applied globally, so data tables keep visible scroll affordances.

### Responsive Design Audit

| Viewport | Assessment |
|---|---|
| **1920×1080** | ✅ Good. `max-w-[1600px] mx-auto` prevents over-stretch |
| **1440×900** | ✅ Good. Sidebar nav starts to overflow → the reported scrollbar |
| **768px** | ⚠️ Sidebar still 220px fixed (29% of width). `grid-cols-3` blocks in `release-control` and `risk-timeline` have no `sm:`/`md:` fallback. `grid-cols-12` layouts collapse awkwardly |
| **390px** | ❌ Broken. Sidebar consumes 56% of the viewport; content pane ~170px. Topbar hides sync/label text but keeps four controls in a 14px-tall bar. Notification dropdown is `w-80` (320px) anchored right → overflows. Command palette is `max-w-lg` at `pt-[15vh]` with `mx-4` — usable, but the input is 16px-safe only by luck |

Other responsive defects:
- No horizontal scroll containers: list rows are flex/grid divs, so on narrow screens content compresses rather than scrolling. (No `<table>` elements exist at all — see Accessibility.)
- `risk-card.tsx` and `shared.tsx` contain **zero** responsive classes.
- Touch targets: sidebar rows are `py-2.5` (~36px), topbar icon buttons `w-8 h-8` (32px) — both below the 44px WCAG 2.5.5 target.
- `h-screen` on the shell breaks on mobile browsers with dynamic toolbars — use `h-dvh`.

### Component UX Review

Current coverage across all 14 pages:

| State | Status |
|---|---|
| Loading | ❌ none — data is synchronous module imports |
| Empty | ⚠️ `EmptyState` exists but takes only a message; no icon, no CTA |
| Error | ❌ none — no boundary, no retry |
| Success | ❌ no toasts; every mutation button (Invite Member, Connect, Save, rule toggles) is inert |

Recommended primitive, replacing `shared.tsx:EmptyState`:

```tsx
<EmptyState
  icon={PlugZap}
  title="No Jira connection yet"
  description="Connect Jira to populate sprint, release and QA intelligence."
  action={{ label: 'Connect Jira', href: '/integrations' }}
/>
```

Per-page empty-state copy to write: Dashboard → "Connect Jira to see release health"; Sprint → "No active sprint in the selected board"; Release → "No release in flight"; QA Queue → "QA queue is clear" (positive framing); Risk Timeline → "No risk events in the last 30 days"; Rules → "No rules yet · [Create your first rule]"; Audit Log → "No activity recorded yet".

Also missing at the interaction layer: no toast system, no confirmation dialogs for destructive actions (Members page has a bare `Trash2` button), no optimistic updates, no form validation on login, no unsaved-changes guard on settings, no pagination/sorting/filtering persisted to the URL.

---

## Phase 3 — Performance Improvements

### Lazy loading

Nothing is dynamically imported today. Priorities:

| Target | Action |
|---|---|
| `rule-management.tsx` (484 lines, always mounted) | `next/dynamic` on the rule editor/detail panel |
| Command palette | `dynamic(..., { ssr: false })` — it is mounted in both layouts and only opens on ⌘K |
| Notification dropdown | Render on open, not always |
| Future chart library | Dynamic import with a skeleton fallback; never top-level |
| Framer Motion | `LazyMotion` + `m` components (~70% smaller motion payload) |
| Long lists (QA Queue, Risk Timeline, Audit Log) | Virtualize with `@tanstack/react-virtual` once real data volumes arrive (>100 rows) |

### React performance

Genuine issues (not speculative micro-optimization):

1. **`store/dashboard-store.ts:simulateUpdate`** always calls `set(...)`, including in the "unchanged" branch — the hash comparison is dead code, and a new `metrics` object is created every 30 seconds, invalidating every consumer.
2. **`topbar.tsx:243`** destructures the entire store (`const { metrics, liveSignals, simulateUpdate } = useDashboardStore()`) → re-renders on any store change, including `commandPaletteOpen`. Same pattern in `sidebar.tsx` and `command-palette.tsx`. Use selectors.
3. **`command-palette.tsx:38`** — `filtered` is recomputed each render and is a dependency of a `useEffect` that adds/removes a `keydown` listener → **listener churn on every keystroke and every parent render**. Wrap in `useMemo` (this one is meaningful).
4. **Two independent ⌘K handlers** (`use-keyboard-shortcuts.ts` and `command-palette.tsx`) both toggle the palette on the same event. They currently work only because the hook runs at a different level; this is a latent double-toggle bug. Consolidate into one.
5. **`topbar.tsx:useRelativeTime`** — a 5s interval per mount; fine, but it re-renders the whole topbar. Isolate into a leaf component.
6. **Stagger animations** on lists (`staggerChildren: 0.06`) are pleasant at 6 tiles, but at 200 QA rows they produce a 12-second cascade. Cap staggering to the first ~10 items.

Not needed: broad `React.memo` on presentational badges — the render cost is trivial. Don't over-optimize.

### Data loading architecture (preparing for Jira/Slack)

Target shape:

```
services/
  http.ts                  fetch wrapper: auth header, retry, timeout, typed errors
  jira.service.ts          getSprints, getIssues, getBoards, syncStatus
  release.service.ts       getReleases, getGates, promote
  rule.service.ts          CRUD + evaluate
  notification.service.ts  Slack / Teams webhook dispatch
  audit.service.ts
features/*/api/            useSprints(), useReleaseHealth() — TanStack Query hooks
```

Rules of engagement:
- Jira credentials **never** reach the browser. All calls proxy through Next Route Handlers (`app/api/jira/*`) or Server Actions; tokens live in server-only env vars.
- Add TanStack Query for cache/stale-while-revalidate/retry — this replaces the hand-rolled 30s `setInterval` and the "BLE-style hash" logic in the store.
- Zustand keeps **UI state only** (sidebar collapsed, palette open, filters). Server data belongs in the query cache.
- Normalize Jira payloads at the service boundary into the existing `lib/types.ts` domain types — those types are good and should be the contract.
- Real-time: start with polling + `refetchOnWindowFocus`, upgrade to SSE (`app/api/stream`) for live signals. Webhook receivers (`app/api/webhooks/jira`) must verify signatures and be idempotent.
- Add rate-limit handling (Jira returns 429 with `Retry-After`) and a per-workspace sync-status model — the "Live"/"Synced 2m ago" chips are currently hardcoded fiction.

---

## Architecture Improvements

1. **Single `AppShell`** replacing the two identical layouts; sidebar + topbar + drawer state in one place.
2. **`lib/navigation.ts`** as the single nav registry: `{ id, label, icon, href, section, shortcut, permission }` — consumed by sidebar, command palette and keyboard shortcuts, with `permission` driving RBAC-based menu filtering.
3. **`components/ui/` build-out**: Card, Badge, Table, Dialog, Sheet/Drawer, Input, Select, Switch, Tabs, Skeleton, Toast, Tooltip, DropdownMenu. Today ~40 hand-rolled button variants exist across pages; consolidating removes hundreds of lines and fixes focus states globally.
4. **Design tokens actually used.** `globals.css` already defines `--color-ss-*`. Replace hardcoded hex with `bg-ss-card`, `border-ss-border`, etc. This is a prerequisite for light mode and white-labeling — both expected by enterprise buyers.
5. **Multi-tenancy from day one**: workspace-scoped routing (`/w/[slug]/...`), workspace ID on every service call, and a tenant guard in middleware. Retrofitting tenancy later is the single most expensive refactor to defer.
6. **Provider composition** in one `app/providers.tsx` (QueryClient, Auth, Theme, Toaster) mounted in the root layout.
7. **Split the fat feature components.** `rule-management.tsx` (484), `executive-dashboard.tsx` (432), `sprint-intelligence.tsx` (315) each contain 5–8 inline sub-components, mixed data derivation and presentation. Extract sub-components into files and derivation into hooks.
8. **Server Components by default.** Page shells fetch on the server; only interactive islands are client components.
9. **Observability**: Sentry (or equivalent), structured logging in route handlers, and health/status surfacing that reflects real integration state instead of `serviceHealth` mock data.
10. **CI**: typecheck + lint + build + unit tests on PR; preview deploys already come free from Vercel.

---

## Security Improvements

| Area | Finding | Priority |
|---|---|---|
| Authentication | Mock only; `login()` succeeds for any credentials and assigns `admin`. No password verification, no MFA, no SSO/SAML/SCIM | **P0** |
| Session storage | Token in `localStorage` (`auth-context.tsx:29,58`) — readable by any injected script; no expiry validation on restore despite `expiresAt` existing | **P0** |
| Route protection | No `middleware.ts`; all dashboard/settings routes render unauthenticated | **P0** |
| Authorization | `ROLE_PERMISSIONS` + `hasPermission()` exist and are correct in shape, but are **enforced nowhere in the UI** and, by definition, nowhere on a server that doesn't exist. `canManage` allows managing an equal-tier role (`>=`) — likely wrong for peer admins | **P0** |
| Secrets | No `.env.example`, no documented env contract. Jira/Slack tokens must be server-only (`process.env.JIRA_*`, never `NEXT_PUBLIC_*`) | **P0** |
| API security | No API layer yet — build it with per-request auth, workspace scoping, Zod input validation, and rate limiting | **P0** |
| CSRF | Not applicable yet; becomes relevant the moment cookie auth + mutations exist → `SameSite=Lax` + Origin checks on Server Actions | **P1** |
| Webhook security | Planned Slack/Teams/Jira webhooks need HMAC signature verification, timestamp/replay windows, and idempotency keys | **P1** |
| XSS | No `dangerouslySetInnerHTML` found ✅. Risk rises when Jira renders user-authored descriptions/comments — sanitize (DOMPurify) or render as plain text | **P1** |
| Input validation | Login form has no validation beyond `type=email` + `required`. No schema validation anywhere | **P1** |
| Headers | No CSP, HSTS, `X-Frame-Options`, or `Referrer-Policy` configured | **P1** |
| Data exposure | `console.error('[v0] …')` leaks framework provenance; mock data contains plausible-looking names/emails — replace before any customer demo | **P2** |
| Dependency hygiene | No audit step, no Dependabot/Renovate | **P2** |

---

## SaaS Missing Features

### P0 — Critical (blocks first paying enterprise customer)

- **Real authentication**: email/password + OAuth, session management, password reset, email verification.
- **RBAC enforcement**: server-side permission checks; UI gating via `hasPermission`; menu filtering.
- **Multi-tenancy**: workspace/organization isolation on every read and write.
- **Jira integration**: OAuth 2.0 (3LO) app, board/project selection, field mapping, incremental sync, sync status + error surfacing.
- **Data persistence**: a database. Rules, workspaces, members, audit logs currently exist only as mock arrays.
- **Member invitations**: token-based invite emails, pending-invite state, revocation. (Button exists; nothing behind it.)
- **Error handling & observability**: boundaries, retries, monitoring.

### P1 — Important

- Slack / Teams outbound notifications with per-rule routing and quiet hours.
- Notification preferences (per-channel, per-severity, digest scheduling) — the UI exists, unwired.
- Audit log that records real events with actor, IP, and diff; filtering + export.
- Teams page (spec'd, missing): team → members → boards mapping, per-team dashboards.
- Rule builder that persists: create/edit/test/version rules, dry-run against historical sprints.
- Saved views, filters and date ranges reflected in the URL.
- Data export (CSV/JSON) + scheduled email reports — `export:data` permission already exists.
- SSO (SAML/OIDC) and SCIM provisioning — standard enterprise procurement gates.
- Onboarding flow: first-run wizard (connect Jira → pick boards → enable rules).
- API keys + public REST API for customer automation.

### P2 — Nice to have

- Billing: Stripe, plans/seats, usage metering, invoices (UI shell exists at `/billing`).
- Light theme + theme switcher (`UserPreferences.theme` already models it; `<html>` is hardcoded dark).
- i18n (`UserPreferences.language` modeled, unused).
- Custom dashboards / widget arrangement.
- Predictive risk trends, benchmarking across sprints.
- Mobile-optimized "on-call" view.
- Jira-adjacent integrations: GitHub/GitLab, Datadog, PagerDuty.
- In-app changelog, help center, support widget.

---

## Phase 6 — Accessibility Review

| Check | Status | Detail |
|---|---|---|
| Semantic landmarks | ⚠️ | `<nav>`, `<main>`, `<header>` present but unlabeled; no `<h1>` on dashboard pages (topbar `<h1>` is a 14px chrome label, not page content) |
| Keyboard navigation | ⚠️ | Links/buttons are focusable, but numeric `1`–`6` shortcuts fire without modifiers and conflict with browser/AT quick-nav; sidebar collapse and topbar controls have no visible focus ring |
| Focus states | ❌ | Only `components/ui/button.tsx` defines `focus-visible` styles — and it's barely used. Hand-rolled buttons rely on `outline-none` defaults |
| Focus trap / dialogs | ❌ | Command palette and notification dropdown have no `role="dialog"`, `aria-modal`, focus trap, or focus restore. The palette closes on ESC ✅ but the dropdown does not |
| ARIA | ❌ | Zero `aria-*` in all 8 dashboard components. Missing: `aria-current` (nav), `aria-expanded` (collapse, dropdown), `aria-live` (live signals, sync status), `aria-label` on icon-only buttons in Members/Integrations |
| Color contrast | ⚠️ | `#64748B` on `#151D32` ≈ **3.4:1** — fails AA for body text (used pervasively for labels). `#94A3B8` on `#151D32` ≈ 6.5:1 ✅. 9–10px type (`text-[9px]`, `text-[10px]`) compounds this |
| Non-color status | ❌ | Risk/severity conveyed by color alone in `SeverityDot`; add text or shape |
| Screen readers | ❌ | Progress bars are unlabeled divs (need `role="progressbar"` + values); badge counts have no accessible names; decorative icons not `aria-hidden` |
| Motion | ❌ | No `prefers-reduced-motion` handling despite pervasive animation |
| Skip link | ❌ | Absent — keyboard users tab through 14 nav items on every page |
| Data tables | ❌ | No `<table>` anywhere; tabular data is rendered as divs, so screen readers lose row/column relationships |

Estimated current Lighthouse Accessibility: **~65–75**. Achievable: 95+.

---

## Phase 7 — Code Quality

**Strengths:** consistent formatting, clear domain vocabulary, well-modeled `lib/types.ts`, thin route files, sensible section-comment banners.

**Problems:**

| Concern | Location |
|---|---|
| God components | `rule-management.tsx` (484), `executive-dashboard.tsx` (432), `sprint-intelligence.tsx` (315) — each holds 5–8 inline sub-components |
| Duplicated layouts | `app/(dashboard)/layout.tsx` ≡ `app/(settings)/layout.tsx`, byte-identical |
| Duplicated nav data | 3 locations, already divergent |
| Duplicated color maps | `RiskLevelBadge`, `SeverityDot`, `PriorityBadge`, `GateStatusBadge`, `CATEGORY_META`, plus inline ternaries in `executive-dashboard.tsx:97` — the same risk→color mapping expressed 6+ ways |
| Magic hex literals | ~500 occurrences of `#151D32`/`#1E2D4A`/`#64748B`/`#6C63FF` despite tokens existing |
| Duplicated button styling | `px-4 py-2 bg-[#6C63FF] hover:bg-[#5B52CC] …` repeated across Members, Integrations, Workspace, Billing, Profile |
| Misleading naming | `components/dashboard/` holds unrelated feature pages; `simulateUpdate` will survive into production naming; `SyncIndicator` claims "BLE polling active" — a Bluetooth term with no meaning in this domain |
| Dead code | `lastHash`/`hashMetrics` comparison has no effect; `selectedNav` in the store is never read (pathname is used); `PERMISSION_DESCRIPTIONS` unused; several unused lucide imports in `sidebar.tsx` (`Bell`, `AlertTriangle` aliasing) |
| Error handling | One `try/catch` in the codebase (`auth-context.tsx:31`). `login()` cannot throw, so the login page's error branch is unreachable |
| Logging | A single `console.error` with a `[v0]` prefix. No logger, no levels, no correlation IDs |
| Type escapes | `canAccess` returns `any[]`-derived boolean via `require`; `navItems` typed then `as const` (contradictory) |
| Tests | None |

**Refactor targets, in order:** `lib/auth-context.tsx` → `sidebar.tsx` → `rule-management.tsx` → `executive-dashboard.tsx` → `store/dashboard-store.ts` → `shared.tsx` (consolidate into a real design system).

---

## Phase 8 — Vercel Deployment Optimization

| Area | Finding | Action |
|---|---|---|
| Rendering | All routes effectively client-rendered | Convert page shells to Server Components; stream with `<Suspense>` |
| Bundle | No analyzer; framer-motion + all-client pages dominate | Add `@next/bundle-analyzer`; `LazyMotion`; dynamic-import heavy panels |
| Static generation | Marketing/auth/help pages could be fully static | Keep dashboards dynamic (per-tenant), prerender `/auth/*`, `/help` |
| Images | `unoptimized: true` disables the Vercel image pipeline | Remove the flag; use `next/image` with explicit sizes; convert `placeholder-*.png` to WebP/AVIF |
| Fonts | ✅ `next/font` with Inter + JetBrains Mono, CSS variables | Add `display: 'swap'`; subset JetBrains Mono (it's used only for small numerals/kbd) |
| Caching | No `revalidate`, no `fetch` cache strategy (nothing is fetched) | Set per-service revalidation; ISR for slow-moving reference data |
| Env handling | No `.env.example`, no runtime validation | Add `.env.example` + Zod-validated `lib/env.ts`; server-only Jira/Slack secrets |
| Headers | None configured | Add CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy` in `next.config.mjs` |
| SEO | `generator: 'v0.app'`, no `metadataBase`, no OG image, no `robots.ts`/`sitemap.ts` | Add all; app routes should be `noindex`, marketing routes indexed |
| Regions/runtime | Not configured | Pin functions to the region nearest the Jira instance; Edge runtime for middleware only |

**Lighthouse projection**

| Category | Now (est.) | After Weeks 1–2 | After Week 4 |
|---|---|---|---|
| Performance | 70–80 | 88 | 95+ |
| Accessibility | 65–75 | 90 | 98 |
| Best Practices | 85 | 95 | 100 |
| SEO | 75 | 92 | 100 |

---

## Refactoring Roadmap

### Week 1 — Critical fixes
1. Sidebar overhaul: hidden-until-hover scrollbar, mobile drawer, persisted collapse, remove the `mounted` null-return, `aria-current`, 44px targets, regrouped sections.
2. Single `lib/navigation.ts`; wire sidebar + palette + shortcuts to it; fix the double ⌘K handler.
3. Unify layouts into one `AppShell`.
4. `middleware.ts` route protection + `AuthProvider` at the root; fix `require()` in `canAccess`; expire sessions on restore.
5. Re-enable TypeScript build errors; add ESLint config + dependency; fix fallout.
6. Responsive fixes at 768/390 (grid fallbacks, `h-dvh`, dropdown positioning, overflow containers).

### Week 2 — Performance & states
7. Skeleton, EmptyState (with CTA), ErrorState (with Retry) primitives + `error.tsx`/`loading.tsx`/`not-found.tsx` per route group.
8. Zustand selectors; fix `simulateUpdate`; `useMemo` the palette filter; cap stagger.
9. `LazyMotion`; dynamic-import the command palette, rule editor and notification panel.
10. Remove `images.unoptimized`; move `shadcn` to devDependencies; drop the `hono` override if unused; add bundle analyzer.
11. Accessibility pass: focus-visible everywhere, dialog semantics + focus trap, `aria-live` on sync/signals, contrast fixes for `#64748B` text, `prefers-reduced-motion`, skip link.

### Week 3 — Architecture
12. `services/` layer + typed `http.ts`; TanStack Query; all mock imports moved behind service functions returning the same domain types.
13. Route handlers `app/api/*` with Zod validation, workspace scoping and rate limiting; Jira OAuth flow + webhook receivers with signature verification.
14. Design-system build-out in `components/ui/`; replace hardcoded hex with `--color-ss-*` tokens; delete duplicated button/badge styling.
15. Reorganize into `features/*`; split the three god components.
16. Providers composition, Sentry, structured logging, `.env.example` + validated env module.

### Week 4 — Enterprise features
17. Real auth (Auth.js/WorkOS): sessions in httpOnly cookies, register/reset/verify, MFA hook points.
18. RBAC enforced server-side + permission-gated UI and navigation.
19. Multi-tenant workspace routing and data isolation.
20. Invitations, Teams page, real audit logging, notification preferences → Slack/Teams delivery.
21. Security headers, CSP, `pnpm audit` + Dependabot, CI (typecheck/lint/build/test), Playwright smoke tests on the critical paths.

---

## Appendix — Quick Wins (< 1 hour each)

- Scope scrollbar CSS to the nav and hide it until hover.
- Delete the duplicate `(settings)` layout.
- Move `shadcn` to `devDependencies`.
- Remove `generator: 'v0.app'` and the `[v0]` log prefix.
- Add `display: 'swap'` to both fonts.
- Remove `images.unoptimized`.
- Add `aria-label` to the six icon-only buttons in Members/Integrations/Topbar.
- Add `aria-current="page"` to the active nav link.
- Fix or remove the `/auth/register` link.
- Swap `h-screen` → `h-dvh` in the app shell.
