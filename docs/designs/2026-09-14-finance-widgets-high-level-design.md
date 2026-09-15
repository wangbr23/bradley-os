# Finance Widgets — High-Level Technical Design

**Date:** 2026-09-14  
**Status:** Design; derived from the product spec `2026-09-14-finance-widgets-product-spec.md` and grounded in `2026-09-14-plaid-integration-research.md` and the current codebase.  
**LLD:** `2026-09-14-finance-widgets-high-level-design-lld.md` (pins mechanisms and file-level shapes)

## 1. Overview

This design adds two home-board widgets — **Bank Accounts** and **Credit Cards** — to Bradley OS, backed by Plaid. The backend is a Plaid integration that stores connection metadata, cached account balances, and recent transactions locally; the frontend is two new board panels following the existing `PanelShell` pattern.

Everything in the existing architecture carries over: Server Actions are the only API, Turso + Drizzle is the only persistence, Plaid is a new server-only dependency, and no separate service or queue is introduced.

**Scope boundary:** read-only views plus the connect/repair/disconnect lifecycle. No money movement, no Liabilities, no statements, no budgeting (see product spec Out of Scope).

## 2. Architectural context

Grounded in the current code:

- **Server Actions carry the backend** (`app/actions/calendar.ts`, `app/notes/actions.ts`); there is no separate API service. Finance gets `app/actions/finance.ts`.
- **Auth**: Auth.js Google provider with a single-email allowlist in `auth.ts`. `proxy.ts` protects every non-Auth route. The one deliberate exception is the Plaid webhook route (`app/api/plaid/webhook/route.ts`), which must be reachable without a session and authenticates Plaid itself.
- **Board**: `components/board/board-client.tsx` renders `react-grid-layout` panels. New panels join via the `resolveLayout()` append pattern (like `todos`) so existing persisted layouts are preserved — this satisfies FR-3.7 without new machinery.
- **Panels**: `PanelShell` provides the card chrome (glyph, eyebrow, title, headline stat, rows, footer). Finance panels are client components like `todos-panel.tsx`, with optimistic local state where it helps (FR-3 flows).
- **Home page** (`app/page.tsx`) does fast local reads in a `Promise.all` and passes snapshot data into the board. Finance snapshot data is a fast Turso read (no Plaid calls on render), so it joins that same `Promise.all`.
- **Caching**: the existing 60-second stale-while-revalidate server snapshots (inbox/calendar) and the browser-session panel cache must **not** be used for finance data (NFR-1.4). Finance reads are `no-store`; the home page is already `force-dynamic`.
- **Schema conventions**: Drizzle `sqliteTable` with text IDs and `integer` timestamps; JSON blobs for structured payloads. Finance tables follow the same style, with Plaid's own IDs as primary keys.

## 3. Data model

Three new tables in `lib/db/schema.ts`, following the shape suggested in the research doc:

### `plaid_items` — one row per institution login (one Item)

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text PK | Plaid `item_id` |
| `institutionId`, `institutionName` | text | For display |
| `encryptedAccessToken` | text | AES-256-GCM ciphertext + nonce + tag + key-version marker (see §7) |
| `status` | text | `healthy` \| `needs_attention` (drives FR-3.3) |
| `lastErrorCode` | text nullable | e.g. `ITEM_LOGIN_REQUIRED`, `OAUTH_CONSENT_EXPIRED` — for the widget's repair message |
| `consentExpiresAt` | timestamp nullable | Populated when Plaid reports one; drives proactive repair (FR-4.4) |
| `syncCursor` | text nullable | Plaid `/transactions/sync` cursor; atomic with transaction writes |
| `lastSyncAt` | timestamp nullable | Feeds the widget's Last updated display (FR-4.2) |
| `createdAt`, `updatedAt` | timestamp | |

### `financial_accounts` — one row per account

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text PK | Plaid `account_id` |
| `itemId` | text FK → `plaid_items.id` (cascade delete) | |
| `name`, `mask` | text | Mask e.g. `4321`; full account number never stored (NFR-1.2) |
| `type`, `subtype` | text | `depository`/`credit` type drives which widget shows the account |
| `currentBalance` | real | Cached balance from Transactions data |
| `availableBalance` | real nullable | |
| `currencyCode` | text | |
| `updatedAt` | timestamp | |

### `financial_transactions` — one row per transaction

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text PK | Plaid `transaction_id` |
| `accountId` | text FK → `financial_accounts.id` (cascade delete) | |
| `amount` | real | Signed; negative = outflow (matches Plaid) |
| `date` | text | `YYYY-MM-DD` (Plaid format) |
| `name` | text | Description shown in the widget |
| `pending` | boolean | Drives the pending label (FR-1.4/FR-2.4) |
| `updatedAt` | timestamp | |

Indexes: `financial_transactions(account_id, date)` for the per-account "five most recent" reads; `financial_accounts(item_id)` for the widget grouping.

**Deliberate omissions (KISS + "persist only what the product uses"):**
- **No category/merchant columns.** The widgets display name, date, amount, pending. Categories can be added later only when a widget needs them.
- **No Liabilities, statements, or routing/account numbers** (spec Out of Scope).
- **Amounts stored as REAL.** Plaid sends decimal values; SQLite floats display correctly to cents for a handful of accounts. If aggregation math ever matters (budgeting), revisit; not now.

**Hard invariant — no full numbers, ever (NFR-1.2):** the finance schema has no column capable of holding a full account, card, or routing number — `mask` (Plaid's own last-4) is the only number-derived field. The Transactions-only product set (§4) means Plaid never returns full numbers in any call we make. Any future column addition must preserve this invariant.

## 4. Backend structure

New server-only modules under `lib/plaid/`:

- `lib/plaid/client.ts` — official `plaid` Node SDK wrapper (one `Configuration` + `PlaidApi` instance per environment). New dependency: `plaid` + `react-plaid-link` (the latter only ever loads client-side).
- `lib/plaid/crypto.ts` — `encryptAccessToken`/`decryptAccessToken` (AES-256-GCM; nonce + ciphertext + tag + key-version marker stored alongside; key from `FINANCE_ENCRYPTION_KEY` env, never in the DB).
- `lib/plaid/sync.ts` — the `/transactions/sync` loop: paginate until `has_more` is false, apply `added`/`modified`/`removed` and write the final cursor in **one Drizzle transaction**; on any Plaid error or mutation-during-pagination, abort and restart from the stored cursor (idempotent, safe against duplicate webhook delivery).
- `lib/plaid/webhook.ts` — Plaid webhook signature verification: require the `Plaid-Verification` header JWT, ES256, `iat` within 5 minutes, and constant-time comparison of the body hash against the **raw, untouched** request body. Returns the parsed webhook type.
- `app/api/plaid/webhook/route.ts` — the only unauthenticated route: POST-only, strict body-size limit, verifies signature, then cheaply updates the item (`status`, `consentExpiresAt`, dirty flag) and returns 200. **No sync work in the webhook** — sync runs on the next board load, manual refresh, or after repair (no queue for one user; Plaid's own 1–4×/day schedule plus webhooks keep data fresh).

`proxy.ts` matcher gains one narrow exclusion: `api/plaid` joins the existing `api/auth` exception. Every other route stays protected.

### Server actions (`app/actions/finance.ts`)

All actions call a hardened `requireOwner()` first (see §7):

- `createLinkToken(mode)` — for connect (`products: ["transactions"]`, history window from §10, webhook URL, redirect URI) or update mode (`access_token` for the existing item).
- `exchangePublicToken(publicToken)` — `/item/public_token/exchange`, then `/item/get` + `/accounts/get`; **duplicate-Item prevention** (compare existing items at the same institution, per Plaid's duplicate-items guidance) before storing; encrypt token; initial sync.
- `syncNow()` / `syncItem(itemId)` — run the sync engine for dirty or all healthy items (manual refresh, FR-4.3).
- `getFinanceSnapshot()` — pure Turso read used by `app/page.tsx`; never touches Plaid.
- `repairItem(itemId)` — returns a link token for update mode; on `onSuccess` no token exchange is needed (access token is unchanged), just re-sync.
- `disconnectItem(itemId)` — call `/item/remove` first; **only after success** delete the item's local rows (cascade covers accounts/transactions). On failure, keep the token and return an error so the user can retry (FR-3.6). Also stops subscription billing.

## 5. Key flows

### 5.1 Connect (FR-3.1, FR-3.2)

1. Panel action → `createLinkToken("connect")`.
2. Client opens Plaid Link via `react-plaid-link` (loaded with `next/dynamic`, `ssr: false`, like Excalidraw). Bank credentials are entered into Link / the bank's OAuth page — never into Bradley OS.
3. `onSuccess(public_token)` → `exchangePublicToken` → encrypted token stored, item + accounts persisted, initial sync runs.
4. Panel updates optimistically; `revalidatePath("/")`.

### 5.2 Data updates (FR-4.1, FR-4.2)

- **Initial sync** on connect; **incremental sync** from the stored cursor.
- **Triggers:** webhook marks the item dirty (default update webhooks fire when Plaid has new data); board load starts a fire-and-forget sync for dirty items; manual refresh (FR-4.3); completion of update-mode repair.
- Last updated shown per widget = the newest `lastSyncAt` among its items.

### 5.3 Repair / reauthorization (FR-3.3, FR-3.4, FR-4.4, FR-4.5)

- `ITEM_LOGIN_REQUIRED` error (webhook or API call) or `PENDING_DISCONNECT`/`PENDING_EXPIRATION` webhook → item marked `needs_attention` (with error code and consent expiry).
- Plaid fires `PENDING_DISCONNECT` one week before consent expiry — the widget shows the repair prompt proactively; the app **never** prompts on its own schedule (confirmed principle).
- Repair launches Link in update mode; Plaid shows an abbreviated re-auth (often just an OTP). `LOGIN_REPAIRED` webhooks (self-healing via another app) clear `needs_attention` automatically.
- While broken, the widget keeps showing last-known data labeled outdated (FR-4.5).

### 5.4 Disconnect (FR-3.5, FR-3.6)

Widget → confirm → `disconnectItem` → `/item/remove` → on success delete local rows (cascade), on failure keep everything and surface the error.

### 5.5 Manual refresh (FR-4.3)

Panel refresh button → `syncNow()` → returns newest available data; the widget updates last-updated only on a successful sync.

## 6. Frontend

Two new client panels in `components/board/`, both `PanelShell`-based:

- **`bank-accounts-panel.tsx`** — headline stat = combined balance across depository accounts (FR-1.1); rows = each account with its own balance (FR-1.2); transaction list = five most recent across those accounts (FR-1.3, pending labeled FR-1.4); footer = Last updated + refresh; empty state with "Connect bank" (FR-1.5); per-connection "Needs attention — repair" row action and disconnect affordance.
- **`credit-cards-panel.tsx`** — tabs, one per credit account (up to five) (FR-2.1); each tab: current balance + five most recent transactions (FR-2.2); card labeled issuer + mask (FR-2.3); same pending labels, empty state, last-updated, repair/disconnect affordances.
- Shared pieces: a `TransactionRow` component, a small connection-status row (healthy / needs attention / disconnected), and a `PlaidLinkLauncher` client component (dynamic import of `react-plaid-link`) reused by both panels.

**Board integration** (`board-client.tsx`): add the two panels with keys `bank-accounts` and `credit-cards`; extend `resolveLayout()`'s append logic (same pattern as `todos`) so both appear below the saved layout on first encounter and never reset existing positions (FR-3.7).

**Data flow:** `app/page.tsx` fetches `getFinanceSnapshot()` in the existing `Promise.all` (local read only, ~instant) and passes it to the panels; panels do their own connect/repair/disconnect/refresh through server actions with optimistic updates and rollback, matching the todos pattern. `revalidatePath("/")` after mutations; the page is `force-dynamic` so fresh data renders without caching.

### 6.1 Transaction details page (exploration — spec FR-5, pending confirmation)

A protected, server-rendered details route per account lists one account's transactions beyond the recent five, paginated by date (exact route path at implementation). It reads only the locally cached `financial_transactions` via the planned `financial_transactions(account_id, date)` index — no new tables, no Plaid calls when opening the page, and no sync changes, because `/transactions/sync` already retains the full history window. If FR-5 is confirmed, this makes the history-depth decision (§10.2) user-visible rather than latent insurance, and §8's "no finance page" non-goal is amended accordingly.

## 7. Security

Mapped from the research doc's "Gaps to close" and the spec's NFR-1:

1. **Fix `auth.ts` before this ships:** stop copying `googleAccessToken` into the session object exposed to the client (currently done in the `session` callback). Plaid tokens are never added to the session; provider tokens stay server-only.
2. **Harden `requireOwner()`** (`lib/auth/require-owner.ts`): compare `session.user.email` against `OWNER_EMAIL` directly, not just presence — finance reads/writes get this defense in depth on every action.
3. **Encrypt every Plaid access token** with AES-256-GCM (`lib/plaid/crypto.ts`); key in env, outside Turso. Never log tokens, amounts, or transaction descriptions.
4. **Webhook route** is the only unauthenticated route: ES256 JWT verification, 5-minute window, constant-time body-hash compare on raw bytes, POST-only, body-size limit, returns no financial data, idempotent.
5. **CSP + headers** in `next.config.ts` (currently empty): allow `cdn.plaid.com` frames/scripts and the Plaid API host in `connect-src`; add HSTS, `frame-ancestors`, `X-Content-Type-Options`, conservative Referrer Policy. Blocks loading Plaid Link today — this is a prerequisite for the panels.
6. **No finance caching:** finance actions/snapshot responses are `no-store`; nothing financial goes into the browser-session panel cache (NFR-1.4).
7. **Data minimization:** only masked identifiers stored/shown; full account numbers never requested from Plaid (no Auth product) and never stored; on confirmed disconnect, local rows are purged (NFR-1.5).
8. **Session policy:** the app-session durations (spec Open Question 3) affect only `auth.ts` config, never Plaid connections (FR-4.6/4.7).

## 8. Non-goals and deferred

- Liabilities (due dates, minimums, APRs), PDF statements, budgeting, transfers — spec Out of Scope; schema is deliberately shaped so these are additive.
- No queue, cron, or background worker: webhook marks dirty; page load/refresh/repair do the sync. If staleness ever becomes a problem, a small scheduled job is the next step — not built now.
- No finance page beyond the board panels (spec asks only for widgets), with one drafted exception: the FR-5 transaction details route (§6.1), pending confirmation.

## 9. Rollout and verification

1. **Prereqs:** confirm Plaid account terms in the Dashboard (Trial vs paid, per-Item rates), institution coverage for the intended banks/cards, and the Production HTTPS deployment + webhook boundary. Complete §7 security items and CSP before any live connection. Before any live connection, also audit the final schema and sync code against the §3 hard invariant: no full account, card, or routing number may be persistable.
2. **Sandbox:** build the full flow against `sandbox.plaid.com` — connect, sync pagination, modified/removed transactions, duplicate webhook delivery, `ITEM_LOGIN_REQUIRED` via `/sandbox/item/reset_login`, update mode, consent-expiration via `ins_129644` (30-day expiry sandbox institution), and disconnect failure handling.
3. **One real institution on Trial** for several days before adding more Items (per the research doc's rollout).
4. **Tests:** there is no test suite today; before production the research doc requires focused tests at minimum for token encryption, owner authorization, signature verification, sync reconciliation + cursor rollback, duplicate webhooks, and disconnect failure handling.
5. Widgets go live after the above; visual pass on both panels in light/dark theme.

## 10. Open decisions that block implementation

Mapped from the product spec's Open Questions:

1. **Bank-widget transaction scope** (five combined vs. per account) — display-only decision, no architecture impact; confirm before building the panel.
2. **History depth** — **recommended: 730 days (Plaid's max)**. The widgets show five transactions, but Plaid's history window is chosen at first link and **increasing it later can require deleting and relinking the Item** — a concrete future cost that maxing out now avoids for free (Plaid bills per Item, not per transaction; a few thousand Turso rows are negligible). Must be confirmed before the first Production link.
3. **App-session durations** (24h max + 30-min idle recommended) — touches only `auth.ts`; independent of the finance work.

## 11. Effort

Per the research doc's estimate: roughly 10–16 engineering days for a production-ready Transactions first version including the two panels, plus prerequisite security/deployment work. Sandbox demo alone is 2–3 days. If the FR-5 details page is confirmed, add a modest increment: one page plus pagination.