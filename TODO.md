# TODO

Current and near-term work. Mutable — edit freely, unlike the journal or decisions log.

See `docs/designs/2026-08-15-v1-design-spec.html` for the full design spec this list is derived from.

## Before v0 starts
- Register a Google Cloud project; create an OAuth client with the Calendar scope (done)
- Generate a Gmail App Password (myaccount.google.com/apppasswords, requires 2FA) (done)
- Provision a Turso database and auth token (done)
- Scaffold the Next.js app; fill in `AGENTS.md`'s Stack/Commands sections from the design spec (done)

## v0 — first end-to-end slice
- Auth — sign in with Google, single-email allowlist (done)
- Inbox digest — IMAP fetch, Primary unread/24h list, no styling polish (done)
- Calendar — read Google Calendar, list view only, no drag yet (done)
- Notes — flat list + Tiptap editor, no diagrams yet (done)
- Todos — board-only flat checklist (done)

## v1 — design spec scope
- Today dashboard — Calendar/Inbox/Notes/Todos as a drag-to-rearrange, resizable board on the home screen with persisted layout, see `docs/designs/2026-08-15-board-home-screen.md` (done)
- Calendar — Pacific-time FullCalendar week grid on both the home board and full Calendar page (done)
- Dashboard navigation performance — immediate shell, independent Inbox/Calendar loading, 60-second stale-while-revalidate caches, and manual refresh (done)
- Calendar interactions — drag-to-create / drag-to-move / drag-to-resize with optimistic Google Calendar persistence (done)
- Diagrams — one embedded Excalidraw canvas per note with debounced persistence (done)
- Full-text search across notes (done)
- Notes — flat folders with filtering, create/rename/delete, note moving, and dashboard labels (done)
- Notes — debounced autosave for titles and Tiptap content (done)
- Visual design system applied throughout (palette, type, motion, empty states) (done)

## v1.1 — deferred
- Note ↔ calendar-event linking (deferred)
- Multi-account email (deferred)
- Calendar OAuth sensitive-scope verification (removes weekly re-consent) (deferred)

## Latency improvements
- [x] `T1` Stop note autosave from revalidating and rerendering the open note route — agent, complexity: simple
- [x] `T2` Reduce note-opening latency by parallelizing independent detail reads and loading diagram data only when Diagram mode opens — agent, complexity: complex
- [x] `T3` Remove redundant `router.refresh()` calls after note and folder Server Actions — agent, complexity: simple, depends-on: T2
- [x] `T4` Defer FullCalendar loading so the home Notes panel becomes interactive without waiting for calendar JavaScript (verified by lint/typecheck; full build blocked in this checkout by missing Turso env, same failure on clean tree) — agent, complexity: simple
- [x] `T5` Measure post-change note route timings and query behavior, then decide whether note indexes or list pagination are warranted (observed latency much better; no further work warranted) — manual, depends-on: T1, T2, T3, T4

## Finance integration
- Plaid integration researched — see `docs/designs/2026-09-14-plaid-integration-research.md` (done)
- Competitor app-session and bank-reconnection behavior researched — see `docs/designs/2026-09-14-finance-widgets-product-spec.md` Open Questions (done)
- Finance widgets product spec written (Bank Accounts + Credit Cards widgets, Plaid-backed) — see `docs/designs/2026-09-14-finance-widgets-product-spec.md` (done)
- High-level technical design grounded in the codebase, see `docs/designs/2026-09-14-finance-widgets-high-level-design.md`, with low-level design sibling `docs/designs/2026-09-14-finance-widgets-high-level-design-lld.md` (done)

### Setup and schema
- [x] `T6` Create the Plaid account (Sandbox) and add PLAID_CLIENT_ID, PLAID_SECRET, and FINANCE_ENCRYPTION_KEY to .env — manual, design: docs/designs/2026-09-14-finance-widgets-high-level-design-lld.md
- [x] `T7` Install the new dependencies plaid, react-plaid-link, and jose (plaid 47.0.0, react-plaid-link 5.0.0, jose 6.2.12) — agent, complexity: simple, design: docs/designs/2026-09-14-finance-widgets-high-level-design-lld.md
- [x] `T8` Set up Vitest with the in-memory libsql test harness, add the npm test script, and note the testing approach in AGENTS.md (vitest 5.0.1; @types/node aligned to ^24 per the Node 24 engines pin to satisfy vitest's peer range) — agent, complexity: simple, design: docs/designs/2026-09-14-finance-widgets-high-level-design-lld.md
- [x] `T9` Add the finance schema (plaid_items, financial_accounts, financial_transactions with the two indexes), generate the migration, and push it (migration 0003 generated and harness-verified; schema applied to Turso on 2026-09-18) — agent, complexity: simple, design: docs/designs/2026-09-14-finance-widgets-high-level-design-lld.md

### Security prerequisites
- [x] `T10` Harden requireOwner() to compare the session email against OWNER_EMAIL directly, with a focused test — agent, complexity: simple, depends-on: T8, design: docs/designs/2026-09-14-finance-widgets-high-level-design-lld.md
- [x] `T11` Add security headers (HSTS, frame-ancestors 'none', nosniff, Referrer-Policy) and the Plaid-compatible CSP to next.config.ts — agent, complexity: simple, design: docs/designs/2026-09-14-finance-widgets-high-level-design-lld.md
- [x] `T12` Stop exposing googleAccessToken through the Auth.js session: serve it server-only via lib/auth/google-token.ts (getToken) and update the calendar consumers and session types (session callback removed — auth() sessions now carry only user/expires; calendar consumers read the JWT via lib/auth/google-token.ts with 6 focused tests; 62-test suite, lint, tsc pass) — agent, complexity: complex, design: docs/designs/2026-09-14-finance-widgets-high-level-design-lld.md
- [x] `T35` Fix the Auth.js test mock typing in lib/auth/require-owner.test.ts so npm run build and tsc --noEmit pass — agent, complexity: simple, depends-on: T10

### Plaid backend modules
- [x] `T13` Add lib/plaid/client.ts, the env-driven Plaid SDK singleton (PLAID_CLIENT_ID, PLAID_SECRET, PLAID_ENV) — agent, complexity: simple, depends-on: T7, design: docs/designs/2026-09-14-finance-widgets-high-level-design-lld.md
- [x] `T14` Add lib/plaid/crypto.ts AES-256-GCM access-token encryption in the versioned v1:nonce:ciphertext:tag format, with focused tests — agent, complexity: complex, depends-on: T8, design: docs/designs/2026-09-14-finance-widgets-high-level-design-lld.md
- [x] `T15` Add lib/plaid/sync.ts runItemSync: paginate /transactions/sync, apply added/modified/removed with one-transaction cursor writes, map Plaid errors to item status (balances refreshed for delta-present accounts per the 2026-09-18 decision; 10 focused tests) — agent, complexity: complex, depends-on: T8, T9, T13, T14, design: docs/designs/2026-09-14-finance-widgets-high-level-design-lld.md
- [x] `T16` Add lib/plaid/snapshot.ts: the FinanceSnapshot type and read queries (combined depository balance, depository top-5, per-card window query, per-widget lastSyncAt), with a focused test (2 focused tests; full 28-test suite, lint, typecheck, and production build pass) — agent, complexity: complex, depends-on: T8, T9, design: docs/designs/2026-09-14-finance-widgets-high-level-design-lld.md
- [x] `T17` Add lib/plaid/webhook.ts verifyPlaidWebhook: jose ES256 JWT with per-kid JWKS fetch, iat freshness window, and constant-time body-hash check; test valid, stale, mismatched, and wrong-algorithm signatures (8 focused tests; full 36-test suite, lint, typecheck pass) — agent, complexity: complex, depends-on: T7, T8, design: docs/designs/2026-09-14-finance-widgets-high-level-design-lld.md
- [x] `T18` Add app/api/plaid/webhook/route.ts (POST-only, raw-body read with size limits, verified webhook-to-item updates) plus the proxy.ts api/plaid matcher exclusion, with route tests for 405, 401, and duplicate delivery (12 route tests covering the full §6.12 transition table; also fixed verifyPlaidWebhook to map Plaid's snake_case error.error_code into the typed errorCode field) — agent, complexity: complex, depends-on: T8, T9, T17, design: docs/designs/2026-09-14-finance-widgets-high-level-design-lld.md

### Server actions
- [x] `T19` Add the link-token actions: createLinkToken (connect mode with products, country codes, webhook and redirect params) and repairItem (update mode) — agent, complexity: simple, depends-on: T9, T13, T14, design: docs/designs/2026-09-14-finance-widgets-high-level-design-lld.md
- [x] `T20` Add exchangePublicToken: public-token exchange, duplicate-Item prevention (remove the new token, return the existing item), item and account persistence, and initial sync; test the duplicate branch (6 focused tests incl. the duplicate branch and first-sync failure marking needs_attention; 68-test suite, lint, tsc pass) — agent, complexity: complex, depends-on: T8, T9, T13, T14, T15, T19, design: docs/designs/2026-09-14-finance-widgets-high-level-design-lld.md
- [x] `T21` Add the sync trigger actions syncDirtyItems, syncNow, and syncItem returning the fresh snapshot (9 focused tests covering dirty-only selection, failure-swallowing, healthy-only manual refresh, post-repair sync of a needs_attention item, and unknown-item throws; 77-test suite, lint, tsc pass) — agent, complexity: simple, depends-on: T15, T16, T20, design: docs/designs/2026-09-14-finance-widgets-high-level-design-lld.md
- [x] `T22` Add disconnectItem with /item/remove-first semantics, not-found-treated-as-success retry, and the disconnect-failure test (5 focused tests covering cascade purge, Plaid rejection keeping rows, ITEM_NOT_FOUND retry purge, unknown item, and owner gate; 82-test suite, lint, tsc pass) — agent, complexity: complex, depends-on: T21, design: docs/designs/2026-09-14-finance-widgets-high-level-design-lld.md

### Board panels
- [x] `T23` Add PlaidLinkLauncher: dynamic react-plaid-link import, connect and repair modes, token fetched per open, exit and error states (launcher + client-only opener + module CSS; 82-test suite, lint, tsc pass) — agent, complexity: complex, depends-on: T19, design: docs/designs/2026-09-14-finance-widgets-high-level-design-lld.md
- [ ] `T24` Add the shared finance panel pieces: transaction-row.tsx (signed-amount formatting, pending label), the connection-status row, and finance.module.css — agent, complexity: simple, depends-on: T16, design: docs/designs/2026-09-14-finance-widgets-high-level-design-lld.md
- [ ] `T25` Add bank-accounts-panel.tsx: combined balance stat, per-account rows, five most recent transactions, empty state, repair/disconnect/refresh affordances, built to the confirmed OQ1 scope — agent, complexity: complex, depends-on: T20, T21, T22, T23, T24, T30, design: docs/designs/2026-09-14-finance-widgets-high-level-design-lld.md
- [ ] `T26` Add credit-cards-panel.tsx with one tab per credit card showing balance and five most recent transactions — agent, complexity: complex, depends-on: T20, T21, T22, T23, T24, design: docs/designs/2026-09-14-finance-widgets-high-level-design-lld.md
- [ ] `T27` Wire the panels into the board: page.tsx snapshot prop, board-client.tsx panel entries, DEFAULT_LAYOUT and resolveLayout append for bank-accounts and credit-cards; finance data stays out of the browser-session panel cache — agent, complexity: simple, depends-on: T25, T26, design: docs/designs/2026-09-14-finance-widgets-high-level-design-lld.md

### Verification and go-live
- [ ] `T28` Audit the finance schema and sync/persist code against the no-full-numbers invariant (S3) before any live connection — agent, complexity: simple, depends-on: T9, T14, T15, design: docs/designs/2026-09-14-finance-widgets-high-level-design-lld.md
- [ ] `T29` Run the Sandbox end-to-end pass: connect, sync pagination, modified/removed transactions, duplicate webhook delivery, ITEM_LOGIN_REQUIRED via /sandbox/item/reset_login, update mode, consent expiration (ins_129644), disconnect failure handling, plus a light/dark visual pass on both panels — manual, depends-on: T6, T18, T25, T26, design: docs/designs/2026-09-14-finance-widgets-high-level-design-lld.md
- [x] `T30` Confirm the product spec's open questions: OQ1 bank-widget transaction scope (blocks T25), OQ2 retained history depth, OQ3 app-session durations, OQ4 the draft FR-5 transaction details page — manual, design: docs/designs/2026-09-14-finance-widgets-product-spec.md
- [ ] `T31` Confirm intended institution coverage and the account's Trial/Pay-as-you-go limits and prices in the Plaid Dashboard — manual, depends-on: T6, design: docs/designs/2026-09-14-plaid-integration-research.md
- [ ] `T32` Document the Production HTTPS deployment and webhook boundary before connecting live accounts — manual, design: docs/designs/2026-09-14-plaid-integration-research.md
- [ ] `T33` Connect one real institution on Trial and run it for several days before adding more Items — manual, depends-on: T10, T11, T12, T28, T29, T30, T31, T32, T34, T35, design: docs/designs/2026-09-14-finance-widgets-high-level-design-lld.md

### App sessions (OQ3 resolution)
- [ ] `T34` Configure Auth.js session durations in auth.ts: 24-hour maximum with a 30-minute idle refresh — agent, complexity: simple, depends-on: T30, design: docs/designs/2026-09-14-finance-widgets-product-spec.md
