# Finance Widgets — Low-Level Design

**Date:** 2026-09-14
**Status:** Derived from `2026-09-14-finance-widgets-high-level-design.md` (HLD). The HLD holds the decisions; this document pins the mechanisms and file-level shapes to build from. Nothing here re-litigates a settled decision.
**Grounded in:** the current repo (schema conventions, server-action patterns, `proxy.ts`, board integration), the product spec, and the Plaid research doc.

---

## 1. Overview

The Plaid integration lands as three new Drizzle tables (`plaid_items`, `financial_accounts`, `financial_transactions`), a server-only `lib/plaid/` module set (SDK client, token encryption, sync engine, webhook verification), six server actions in `app/actions/finance.ts`, one unauthenticated webhook route, and two `PanelShell`-based board panels. Plaid remains the remote source; Turso caches balances and transactions locally; sync runs only from four triggers (connect, post-mount dirty check, manual refresh, post-repair) — no queue, no cron. The prerequisite security work (session-token fix, hardened `requireOwner()`, CSP) ships as part of this work, not after it.

## 2. Package/file layout

```
lib/plaid/client.ts          Env-driven Plaid SDK singleton: getPlaidClient() reading PLAID_CLIENT_ID,
                             PLAID_SECRET, PLAID_ENV (sandbox|production → base URL). Server-only.
lib/plaid/crypto.ts          encryptAccessToken / decryptAccessToken (AES-256-GCM, versioned format §6.5).
lib/plaid/sync.ts            runItemSync(itemId): paginate /transactions/sync, apply added/modified/removed,
                             write cursor in one transaction (§6.7). Also maps Plaid errors to item status.
lib/plaid/webhook.ts         verifyPlaidWebhook(request): ES256 JWT + raw-body-hash check (§6.2/§6.3);
                             returns a discriminated parsed webhook or null.
lib/plaid/snapshot.ts        Snapshot read logic (§4.2): pure Turso queries shaping FinanceSnapshot.
                             Kept out of the actions file so actions stay thin and page.tsx imports one type.
app/actions/finance.ts       The six server actions (§5). God-file risk: mapping/serialization must stay
                             in lib/plaid/*; if this file grows past ~150 lines, the mapping leaked.
app/api/plaid/webhook/route.ts  The only unauthenticated route (§5.7): POST-only → verify → cheap update → 200.
components/board/bank-accounts-panel.tsx       Depository widget (client component, PanelShell).
components/board/credit-cards-panel.tsx        Credit widget with per-card tabs (client component, PanelShell).
components/board/transaction-row.tsx           Shared row: description, date, amount, pending label.
components/board/plaid-link-launcher.tsx       Shared client wrapper around react-plaid-link (§6.9).
components/board/finance.module.css            Shared panel presentation (colocated CSS Module).
auth.ts                    session callback stops copying googleAccessToken (§6.11).
lib/auth/google-token.ts   New server-only helper: Google access token from the session JWT via getToken() (§6.11).
lib/auth/require-owner.ts  Hardened: direct OWNER_EMAIL comparison (§6.10).
proxy.ts                   Matcher gains one exclusion: api/plaid (§5.7).
next.config.ts             Static security headers + CSP (§6.12).
types/next-auth.d.ts       Remove googleAccessToken / googleTokenError from the Session interface.
lib/db/schema.ts           Three finance tables appended (§3) + migration via `npm run db:generate`.
```

New tests (§8): `vitest.config.ts` plus six `*.test.ts` files colocated with the modules they test.

New dependencies: `plaid` (server SDK), `react-plaid-link` (client only, dynamically imported), `jose` (JWT verification — already present transitively via `next-auth@beta`; adding it as a direct dep resolves to the same major), `vitest` (dev, test framework decision recorded in `docs/decisions.md`).

## 3. Data model

Three tables in `lib/db/schema.ts`, following the existing conventions (`text` PKs, `integer` timestamps with `mode: "timestamp"`, JSON in `text` columns). Plaid's own IDs are the primary keys — no surrogate IDs anywhere.

### Shape sketches

```
plaid_items
  id                  text PK     — Plaid item_id
  institutionId       text
  institutionName     text
  encryptedAccessToken text       — versioned AES-256-GCM string (§6.5)
  status              text        — 'healthy' | 'needs_attention'   [invariant S1]
  lastErrorCode       text?       — e.g. ITEM_LOGIN_REQUIRED, OAUTH_CONSENT_EXPIRED
  consentExpiresAt    timestamp?  — from PENDING_EXPIRATION webhooks; cleared after repair
  dirty               boolean     — webhook→sync handoff flag (HLD §4; not in the HLD's table sketch)
  syncCursor          text?       — /transactions/sync cursor        [invariant S2]
  lastSyncAt          timestamp?  — only written on a fully successful sync
  createdAt, updatedAt timestamp

financial_accounts
  id                  text PK     — Plaid account_id
  itemId              text FK → plaid_items.id, cascade delete
  name, mask          text        — mask = Plaid's last-4; never a full number
  type, subtype       text        — 'depository' | 'credit' drives widget routing
  currentBalance      real        — as Plaid sends it (credit: amount owed, positive)
  availableBalance    real?
  currencyCode        text        — ISO 4217 from Plaid
  updatedAt           timestamp

financial_transactions
  id                  text PK     — Plaid transaction_id
  accountId           text FK → financial_accounts.id, cascade delete
  amount              real        — stored exactly as Plaid sends it   [see sign note below]
  date                text        — 'YYYY-MM-DD' (Plaid's format, kept verbatim)
  name                text        — description shown in the widget
  pending             boolean
  updatedAt           timestamp

Indexes: financial_transactions(accountId, date), financial_accounts(itemId)
```

**Sign-convention note (discrepancy surfaced):** the HLD's §3 table comment says "negative = outflow (matches Plaid)". Plaid's actual convention is the reverse — **positive = money moving out, negative = money moving in** (debit purchases positive; deposits/refunds negative). The schema stores Plaid's value unchanged, so storage is unaffected either way, but the HLD's parenthetical is reversed and should be corrected there. This LLD pins the actual Plaid convention; the display rule in §6.10 is written against it.

### Named invariants other sections depend on

- **S1 — status is only ever changed by a Plaid signal or a Plaid-API outcome.** No timeout, scheduler, or UI timer ever sets `needs_attention` (FR-4.4). The full transition table is in §6.12.
- **S2 — cursor atomicity:** `syncCursor` is written only inside the same Drizzle transaction that applies that page's `added`/`modified`/`removed`. A partial sync run can never advance the cursor.
- **S3 — no full numbers, ever (NFR-1.2, carried from HLD §3):** the schema has no column capable of holding a full account/card/routing number; `mask` is the only number-derived field. Any future column addition must preserve this.

## 4. Interfaces / API surface

### 4.1 Server actions (`app/actions/finance.ts`)

Every action begins with the hardened `requireOwner()`. Error convention matches the existing actions (todos/notes): throw on failure; panels catch and roll back. Nothing financial is ever returned to an unauthenticated caller because `requireOwner()` throws first.

| Action | Signature sketch | Returns / throws |
| --- | --- | --- |
| `createLinkToken` | `(mode: "connect") => Promise<string>` | Link token string; throws on Plaid failure. Update-mode tokens are created by `repairItem`, not here. |
| `exchangePublicToken` | `(publicToken: string) => Promise<{ itemId: string }>` | Existing item's id if duplicate detected (§6.8), else the new item's id after initial sync; throws on exchange/first-sync failure. |
| `syncDirtyItems` | `() => Promise<FinanceSnapshot>` | Post-mount trigger (§6.4): syncs items with `dirty=1`, returns the fresh snapshot. Never throws to the client — returns the current snapshot on failure. |
| `syncNow` | `() => Promise<FinanceSnapshot>` | Manual refresh (FR-4.3): syncs **all healthy** items regardless of `dirty`, returns the fresh snapshot; throws on total failure. |
| `syncItem` | `(itemId: string) => Promise<FinanceSnapshot>` | Post-repair sync; same semantics as `syncNow` scoped to one item. |
| `repairItem` | `(itemId: string) => Promise<string>` | Link token for update mode bound to that item's decrypted access token. |
| `disconnectItem` | `(itemId: string) => Promise<void>` | `/item/remove` **first**; on success deletes the item row (cascade purges accounts/transactions). On Plaid failure: throws, nothing deleted (FR-3.6). Treats Plaid "item not found"-class responses as success so a failed purge can be retried (§7). |
| `getFinanceSnapshot` | `() => Promise<FinanceSnapshot>` | Pure Turso read (§4.2); never touches Plaid; used by `app/page.tsx` and by the sync actions to return fresh data. |

### 4.2 FinanceSnapshot shape (the one type crossing the server/client boundary)

```
FinanceSnapshot
  bank
    accounts        AccountView[]      — depository accounts (name, mask, balances, currency)
    combinedBalance number             — sum of currentBalance across them
    recent          TransactionView[]  — 5 most recent across those accounts (§6.8 query)
    lastSyncAt      timestamp?         — newest lastSyncAt among items owning ≥1 depository account
  cards
    accounts        AccountView[]      — credit accounts
    perAccount      { accountId, transactions: TransactionView[] }[]   — 5 most recent each (§6.8 query)
    lastSyncAt      timestamp?         — same rule over items owning ≥1 credit account
  items             ItemView[]         — id, institutionName, status, lastErrorCode, consentExpiresAt
                                       (each panel joins accounts→items for status/repair affordances)
TransactionView    = { id, name, date, amount, pending, currencyCode }
```

Serialized over the RSC boundary as plain JSON — no dates beyond what `PanelShell` consumers format client-side.

**Caching rule (NFR-1.4, carried from HLD §7.6):** finance data never enters the browser-session panel cache (`components/board/dashboard-cache.ts`) — the panels never touch that module — and finance reads are plain `force-dynamic` Turso reads; no finance response sets a cache header and nothing financial persists in the browser beyond the current view.

### 4.3 Webhook route contract (`app/api/plaid/webhook/route.ts`)

- `POST` only → `405` otherwise. Not protected by Auth.js: `proxy.ts` matcher becomes `/((?!api/auth|api/plaid|sign-in|robots.txt|_next/static|_next/image|favicon.ico).*)`.
- Reads the **untouched raw body** via `await request.text()` (route handlers deliver the raw bytes; no framework JSON parsing in between).
- Size limit: reject with `413` if `content-length` > 10,000 bytes, and again after reading if the text exceeds 10,000 chars (guards chunked bodies with no length header).
- `verifyPlaidWebhook` (§6.2/§6.3) on failure → `401` with an empty body. On success → one cheap conditional `UPDATE` on `plaid_items` (status / consentExpiresAt / dirty per §6.12) → `200`, empty body, no financial data returned ever.
- Unknown `item_id` or unrecognized webhook code after verification → still `200` (Plaid retries on non-2xx; there is nothing useful to do for one user) and a minimal `console.log` of type + item_id only (no amounts, names, or tokens — research doc logging rule).

### 4.4 Module boundaries

`lib/plaid/*` modules import `getPlaidClient()` from `client.ts` and never import actions; actions import modules and `snapshot.ts`; panels import actions only. `react-plaid-link` is imported only inside `plaid-link-launcher.tsx` via `next/dynamic(..., { ssr: false })` — the same client-only pattern as Excalidraw — so `plaid` SDK code never enters a client bundle.

## 5. Flow sequences

### 5.1 Connect (FR-3.1, FR-3.2)

1. Panel "Connect bank/card" → `plaid-link-launcher.tsx` (already mounted, token not yet fetched) calls `createLinkToken()`.
2. Launcher's inner component (`usePlaidLink` from `react-plaid-link`, dynamically imported) opens Link with that token. Credentials go to Plaid/the bank's OAuth page only.
3. `onSuccess(publicToken)` → `exchangePublicToken`: `/item/public_token/exchange` → decrypt-free `/item/get` (institution metadata) + `/accounts/get` (accounts + balances).
4. Duplicate check (§6.6): if `plaid_items` already has the same `institutionId`, call `/item/remove` on the **newly created** token and return the existing item's id — no local writes (stops the duplicate-billed Item).
5. Otherwise: encrypt the access token, insert `plaid_items` + `financial_accounts` rows, run `runItemSync` (initial sync, §5.2).
6. Panel swaps in the returned snapshot; launcher shows exit/error states on `onExit` or thrown failures.

### 5.2 Sync engine (`runItemSync` in `lib/plaid/sync.ts`)

1. Load the item's stored `syncCursor` (null → first run) and decrypt the access token.
2. Loop `client.transactionsSync({ access_token, cursor, count: 100 })` while `has_more`, collecting `added`/`modified`/`removed`.
3. Apply everything plus the final cursor in **one** `db.transaction` (invariant S2): `added` → `onConflictDoUpdate` upserts; `modified` → same upserts; `removed` → delete by id (`inArray`, chunked); set `lastSyncAt`, clear `dirty` if it was set, clear auth-related `lastErrorCode` if the sync succeeded while healthy.
4. Any Plaid error (including `TRANSACTIONS_SYNC_MUTATION_DURING_ITERATION`) → abort before writing; the stored cursor is untouched, so the next trigger re-runs cleanly (idempotent — upsert/delete semantics make re-application a no-op).
5. Auth-class errors (`ITEM_LOGIN_REQUIRED`, `INVALID_CREDENTIALS`, `OAUTH_CONSENT_EXPIRED`, …) additionally mark the item `needs_attention` with `lastErrorCode` (§6.12).

### 5.3 Webhook → dirty → next board load (FR-4.1)

1. Plaid POSTs → route verifies (§6.2), then sets `dirty=1` (transactions updates), or updates `status`/`consentExpiresAt`/`lastErrorCode` per §6.12, → `200`.
2. No sync work in the webhook (HLD §4).
3. On the next board render, the finance panels' post-mount effect calls `syncDirtyItems()` (§6.4), which syncs the dirty items and returns the fresh snapshot; panels reconcile their local state with it. Trigger list stays: connect, post-mount dirty check, `syncNow`, post-repair.

### 5.4 Repair / update mode (FR-3.3, FR-3.4, FR-4.4, FR-4.5)

1. Widget shows "Needs attention — repair" (from `items.status` + `lastErrorCode`, and proactively from `consentExpiresAt` — Plaid fires `PENDING_DISCONNECT` ~1 week early; the app never prompts on its own schedule).
2. `repairItem(itemId)` → update-mode link token carrying the item's decrypted `access_token`.
3. Link shows the abbreviated re-auth. `onSuccess`: the returned `public_token` (present for re-auth cases) is **ignored** — the access token is unchanged — and the client calls `syncItem(itemId)`.
4. A successful post-repair sync sets `status='healthy'`, clears `lastErrorCode` and `consentExpiresAt`, clears `dirty`. If the sync still fails with an auth error, the item stays `needs_attention` — no optimistic healing.
5. While `needs_attention`, the panel keeps showing last-known data labeled outdated (FR-4.5).

### 5.5 Disconnect (FR-3.5, FR-3.6)

1. Confirm (explicit UI confirmation) → `disconnectItem(itemId)`.
2. `/item/remove` first. Failure → throw; rows and encrypted token stay; panel surfaces the error and offers retry (FR-3.6).
3. Success → `DELETE FROM plaid_items WHERE id = itemId` — cascades purge accounts and transactions (NFR-1.5). If that delete itself fails (DB outage), the Plaid item is already gone; the panel shows the error, and a retry hits Plaid's "item not found"-class response, treated as success, and purges then (§7).

### 5.6 Manual refresh (FR-4.3)

Refresh button → `syncNow()` → all healthy items synced regardless of `dirty` → fresh snapshot returned; `lastSyncAt` only moves for items whose sync succeeded. A needs-attention item is **not** synced by manual refresh (its data can't move until repair) — its row stays labeled outdated.

### 5.7 Board render (NFR-3.1, NFR-3.2)

1. `app/page.tsx` adds `getFinanceSnapshot()` to the existing `Promise.all` — pure Turso reads, ~instant, no Plaid calls on render.
2. Snapshot passed into `BoardClient` → both finance panels.
3. After mount, panels fire the single post-mount `syncDirtyItems()` effect (once per page load, not per panel) — async, never blocks interactions.
4. Mutations (connect/repair/disconnect/refresh) follow the todos-panel optimistic pattern: apply locally, call the action, reconcile with the returned snapshot, roll back with an error state on failure.

## 6. Mechanisms (choices the HLD left open, pinned)

1. **Dirty handoff = a `dirty` boolean column on `plaid_items`.** The HLD's §4 names a dirty flag but the §3 table omits it; the column makes webhook→sync stateless and crash-safe. Board-load sync targets `dirty=1`; manual refresh ignores the flag.
2. **Webhook verification via `jose`, JWKS fetched per-`kid`.** Decode the `Plaid-Verification` JWT header, fetch the JWKS from `https://cache.plaid.com/webhooks/verification_jwks/{kid}`, `jwtVerify` with `algorithms: ["ES256"]`, then require `iat` within 5 minutes and `timingSafeEqual(sha256(rawBody), claim.request_body_sha256)`. Why jose: next-auth@beta already ships it, so no new crypto hand-rolling. The JWKS fetch is an injectable parameter (default `fetch`) so tests supply their own key — no mocking library needed.
3. **Webhook returns 200 to everything verified, even unknown items/types.** Plaid retries non-2xx; for a dead `item_id` a retry would loop forever. Idempotent by construction (conditional `UPDATE`s only).
4. **Board-load sync trigger = client post-mount effect → `syncDirtyItems()` action.** This pins the HLD's "board load starts a fire-and-forget sync" onto a transport that works on both long-running and serverless hosts — an in-request server-side fire-and-forget can be frozen after the response on serverless. Accepted weakening: one small client roundtrip per page load.
5. **Token encryption format:** `v1:<b64 nonce>:<b64 ciphertext>:<b64 tag>` in the `text` column; `AES-256-GCM` via `node:crypto`; key = 32-byte hex in `FINANCE_ENCRYPTION_KEY` (missing key → clear throw at first encrypt/decrypt, not at import). The `v1` prefix is a key-version marker so a future key rotation can decrypt old rows and re-encrypt forward — no rotation machinery now.
6. **Duplicate-Item prevention:** after `/item/get` in `exchangePublicToken`, if an item with the same `institutionId` exists, `/item/remove` the new token (stops it becoming a billed orphan) and return the existing item. No lock against a same-institution double-click: one user, serialized server actions — KISS.
7. **Cursor atomicity + restart-from-cursor:** one `db.transaction` per `runItemSync` invocation covers all row mutations plus the cursor write (invariant S2). Drizzle's `libsql` driver supports transactions. A failed run leaves the old cursor, and re-running is idempotent (upserts + deletes by id), so duplicate webhook delivery is harmless by construction.
8. **Snapshot queries:** (a) one query for depository accounts + `SUM(current_balance)` combined stat; (b) depository top-5 = `ORDER BY date DESC, updatedAt DESC, id` `LIMIT 5` joined through accounts; (c) per-card top-5 = a single `ROW_NUMBER() OVER (PARTITION BY account_id ORDER BY date DESC, updatedAt DESC, id)` window query (SQLite core feature, one roundtrip instead of one query per card). Tie-break on `updatedAt` so the newest sync info wins same-day ties.
9. **Link launching:** `plaid-link-launcher.tsx` mounts a button; on click it fetches the token from the server action, then the dynamically imported inner component opens Link. Link tokens expire (~30 min) and public tokens are single-use, so the token is fetched per open, never cached; on `onExit` or exchange failure the user simply re-clicks.
10. **Link token parameters (connect):** `products: ["transactions"]`, `countryCodes: ["US"]`, `clientUserId: "bradley-os-owner"` (stable fake id; no PII), `webhook: PLAID_WEBHOOK_URL` (env), `redirectUri: PLAID_REDIRECT_URI` when the env var is set (required only for Production OAuth institutions — the deployment-boundary TODO), `transactions.daysRequested: 730` (Open Question 2 — accepted-for-now pending confirmation, §10).
11. **Provider-token fix:** `auth.ts`'s `session` callback stops copying `googleAccessToken`/`googleTokenError` into the session (that object is client-exposed); `types/next-auth.d.ts` drops both fields; the JWT callback keeps holding them inside the encrypted cookie. Server consumers (`app/actions/calendar.ts`, `app/calendar/page.tsx`) switch to a new `lib/auth/google-token.ts` that reads the session JWT with `getToken()` from `next-auth/jwt` (same secret/cookie config). Calendar behavior is unchanged; nothing about Plaid tokens ever enters the session.
12. **Item status transition table** (invariant S1):

| Signal | Effect on `plaid_items` |
| --- | --- |
| `TRANSACTIONS_UPDATED` / `INITIAL_UPDATE` / `HISTORICAL_UPDATE` / `TRANSACTIONS_REMOVED` webhooks | `dirty = 1` |
| `ERROR` webhook | `status = 'needs_attention'`, `lastErrorCode = error_code` |
| `PENDING_EXPIRATION` webhook | `needs_attention` + `consentExpiresAt` from the payload |
| `PENDING_DISCONNECT` webhook | `needs_attention` (no new expiry timestamp) |
| `LOGIN_REPAIRED` webhook | `status = 'healthy'`, clear `lastErrorCode` + `consentExpiresAt` |
| Sync succeeds on a `needs_attention` item reached via update-mode repair | `healthy`, clear code/expiry/dirty |
| Sync fails with auth-class code | `needs_attention` + `lastErrorCode`, `lastSyncAt`/`dirty` untouched |
| Sync fails with transient code (maintenance, rate limit) | no status change, `lastSyncAt` untouched |

13. **Security headers (static, in `next.config.ts` `headers()`):** `frame-ancestors 'none'`; `X-Content-Type-Options: nosniff`; strict `Referrer-Policy`; HSTS (with the usual max-age + includeSubDomains). CSP directives Plaid Link needs: `frame-src cdn.plaid.com`, `script-src 'self' 'unsafe-inline' cdn.plaid.com`, `connect-src 'self' *.plaid.com`. Accepted weakening, stated honestly: `'unsafe-inline'` in `script-src` because Next's hydration injects inline scripts and a per-request nonce would need middleware-level CSP work; the allowlist still blocks every third-party origin except Plaid's, which is the concrete threat here. The HLD deliberately simplified the research doc's "nonce-based" CSP to static headers; this pins that simplification.
14. **Amount display:** format with `Intl.NumberFormat("en-US", { style: "currency", currency })` client-side; per the sign note in §3, stored negative = money in → rendered with an explicit `+` prefix and accent styling (NFR-2.2's at-a-glance distinction), stored positive = money out → plain. Pending rows get a "pending" label chip (FR-1.4/2.4).
15. **Combined balance and currency:** `countryCodes: ["US"]` for v1, so the combined stat sums balances that are realistically one currency; if a second currency ever appears, the combined stat re-scopes per currency — not built now.
16. **Test framework: Vitest**, node environment, colocated `*.test.ts`, run via `npm test`. Plaid calls are mocked at the `lib/plaid/client` module seam (`vi.mock`); DB tests run against in-memory libsql (`:memory:`) with the generated schema applied. Decision recorded in `docs/decisions.md`.
17. **Board integration:** `DEFAULT_LAYOUT` gains `bank-accounts` (right column below todos, w 4) and `credit-cards` (left column under inbox, w 8); `resolveLayout()`'s append logic extends to both keys — persisted layouts missing them get them appended below the current bottom-most panel, never resetting saved positions (FR-3.7, same pattern as `todos`).

## 7. Failure/degradation paths

Carried forward from the HLD and research doc; nothing silently dropped.

| Failure | Behavior |
| --- | --- |
| `createLinkToken` throws | Panel shows inline error; retry by re-clicking (token fetched per open) |
| User exits Link (`onExit`) | No-op; no state changed |
| `exchangePublicToken` fails | Error surfaced; public token was single-use → user re-clicks connect |
| Duplicate institution detected | New token `/item/remove`d, existing item's data shown; no duplicate billed Item |
| Sync fails mid-pagination (any Plaid error) | Nothing written (invariant S2); next trigger restarts from stored cursor |
| Mutation during pagination (`TRANSACTIONS_SYNC_MUTATION_DURING_ITERATION`) | Same as above — abort, old cursor preserved |
| Sync auth-class error | Item `needs_attention` + `lastErrorCode`; data stays, labeled outdated (FR-4.5) |
| Sync transient error | Status untouched; `lastSyncAt` untouched; widget shows its existing data |
| Webhook signature invalid / wrong algorithm / stale `iat` / body-hash mismatch | `401`, empty body, zero state change |
| Webhook for unknown `item_id` or unknown type | `200`; log type + item_id only |
| `disconnectItem`: `/item/remove` fails | Nothing deleted, error surfaced, retry offered (FR-3.6) — token retained so the billed Item can still be removed |
| `disconnectItem`: purge fails after successful `/item/remove` | Error surfaced; orphaned rows remain visible; retry treats Plaid "item not found"-class responses as success and purges |
| Post-mount `syncDirtyItems()` fails | Silent — returns current snapshot; last-known data stays; next trigger retries |
| `FINANCE_ENCRYPTION_KEY` missing/wrong | Encrypt/decrypt throw with a clear message at first use; connect/repair/sync fail fast, no partial writes |
| Plaid Link CDN blocked by CSP/misconfig | Launcher error state; CSP directives in §6.13 are the prerequisite |
| Board finance read (Turso) fails | Page-level `Promise.all` rejects as today for any snapshot read; acceptable for a single-user daily-driver |

## 8. Test mapping

HLD §9.4's minimum list, mapped to concrete files. No test suite exists today; Vitest is pinned (§6.16). All are node-environment unit/route tests — no browser.

| HLD verification item | Test file | Scenarios |
| --- | --- | --- |
| Token encryption | `lib/plaid/crypto.test.ts` | Roundtrip; tampered ciphertext/tag rejected; wrong key fails; unknown version marker rejected; missing env throws |
| Owner authorization | `lib/auth/require-owner.test.ts` | No session → throw; wrong email → throw; OWNER_EMAIL (case-insensitive) → pass |
| Signature verification | `lib/plaid/webhook.test.ts` | Valid ES256 JWT (self-signed test key, injected JWKS fetch) → parsed webhook; stale `iat` → null; body-hash mismatch → null; wrong algorithm (HS256) → null; oversized body → null |
| Sync reconciliation + cursor rollback | `lib/plaid/sync.test.ts` | added/modified/removed applied; multi-page `has_more` loop; cursor persisted once at end; Plaid error mid-pagination leaves cursor + `lastSyncAt` untouched; re-run from same cursor is idempotent |
| Duplicate webhook delivery | `app/api/plaid/webhook/route.test.ts` | Same webhook `POST`ed twice → second is a no-op; unknown item → 200; unverified → 401; `GET` → 405 |
| Disconnect failure handling | `app/actions/finance.test.ts` | `/item/remove` throws → no local delete, throw surfaces; "item not found" class after a prior failed purge → purge proceeds |

DB-backed tests (`sync`, `finance`) create an in-memory libsql client, inject it via the existing `lib/db/client` module seam (`vi.mock`), and apply the generated finance-table SQL before each test.

## 9. Contingent: FR-5 transaction details page

Only if Open Question 4 is confirmed (the HLD's §6.1 exploration). Kept to a sketch so it doesn't imply approval:

- `app/finance/[accountId]/page.tsx` — protected server component, `dynamic = "force-dynamic"`, `requireOwner()`-equivalent gate via the session (page-render, not an action), reads only `financial_transactions` by `accountId` using the `financial_transactions(account_id, date)` index.
- Pagination: date-cursor (`?before=YYYY-MM-DD`) pages of ~50, newest first; no Plaid calls when opening; no schema change (`/transactions/sync` already retains the full history window).
- Presentation reuses `transaction-row.tsx`. If not confirmed, nothing in §2–§8 changes — this page is additive.

## 10. Open questions

1. **Bank-widget transaction scope** (five combined vs. per account) — accepted-for-now: **combined across accounts** (HLD recommendation; journal confirms). The snapshot shape (§4.2) supports either; the depository query changes only if per-account wins. Confirm before building the panel.
2. **History depth** — accepted-for-now: **730 days** (`transactions.daysRequested`), per the HLD's recommendation; must be confirmed before the first Production link because it's fixed at first link.
3. **App-session durations** — Open Question 3 of the spec; touches only `auth.ts`; deliberately not designed here. Independent of finance.
4. **FR-5 details page** — Open Question 4; contingent sketch in §9, build only after confirmation.
5. **Deployment boundary** — the webhook route and `PLAID_REDIRECT_URI` only work behind a stable public HTTPS origin; the Production boundary is an unresolved TODO item and blocks live connecting (not sandbox work).
6. **`react-plaid-link` React 19 peer compatibility** — verify at install time; if peer deps conflict, fall back to a thin direct wrapper over Plaid Link's JS initializer (the hook is a thin layer over `cdn.plaid.com/link/v2/stable/link-initialize.js`). Sandbox build will surface it immediately.
7. **Plaid account terms (Trial vs paid, per-Item rates)** — rollout/Dashboard item, outside this design.