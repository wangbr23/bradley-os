# Journal

Append-only. One entry per work session. Newest at the bottom. Don't edit past entries — if something's wrong now, say so in a new entry.

## 2026-08-15 — project created

Initialized project scaffold (AGENTS.md, decisions log, TODO). Nothing built yet.

## 2026-08-15 — v0 authentication completed

Implemented Auth.js Google sign-in, protected application routes, and restricted access to `brwang48198@gmail.com`. Requested offline Google Calendar access and added access-token refresh handling so the calendar slice can reuse the authenticated session. Added sign-in/sign-out UI and generated the local Auth.js secret without exposing it.

Resolved local HTTPS failures by upgrading the development runtime from EOL Node.js 20 to Node.js 24 LTS and using Homebrew's current CA bundle for local Next.js commands when available. Google OAuth now completes successfully. Lint, TypeScript, and the webpack production build pass. Next: build the read-only Gmail IMAP inbox digest.

## 2026-08-15 — v0 inbox digest completed

Added ImapFlow and an authenticated `/inbox` surface that lists unread Gmail messages received within the last 24 hours. The server-only reader opens INBOX read-only, uses Gmail's raw unread/newer-than-one-day search, applies an exact 24-hour cutoff, caps results at 50, and fetches sender, subject, timestamp, and a bounded source preview without setting `Seen`. Added empty and connection-error states plus an inbox link from the signed-in home screen.

Verified the configured account successfully over IMAP without logging message content; 24 messages matched at verification time. Lint, TypeScript, and the webpack production build pass. Next: add the read-only Google Calendar list.

## 2026-08-15 — session progress reconciled

Narrowed the inbox digest from every Gmail inbox category to the Primary category only, while retaining the unread and exact 24-hour filters. The verified match count dropped from 24 messages across all categories to 3 Primary messages. Lint and TypeScript still pass.

Auth and the Primary inbox digest are complete. Next: implement the v0 read-only Google Calendar list using the Calendar token already carried by the Auth.js session.

## 2026-08-15 — v0 calendar list completed

Added Google's official API client and an authenticated `/calendar` page backed by the primary Google Calendar. The server expands recurring events and fetches a seven-day window without storing events locally. The chronological view handles timed and all-day events, empty days, locations, links to Google Calendar, access-renewal guidance, and request failures. Added Calendar navigation from the signed-in home screen.

Verified the view against the owner's real calendar, then changed calendar boundaries, grouping, and display formatting to `America/Los_Angeles` so PST/PDT transitions are handled automatically. Lint, TypeScript, and the webpack production build pass. Next: build the v0 flat notes list and Tiptap editor.

## 2026-08-15 — v0 notes implementation awaiting browser verification

Applied the existing Drizzle schema to the previously empty Turso database, creating the planned notes, diagrams, and todos tables. Added an authenticated `/notes` list, note creation, individual `/notes/[id]` editing, explicit save status, deletion confirmation, and Tiptap controls for bold, italic, headings, and lists. Added Notes navigation from the signed-in home screen and reading-focused editor styles.

Verified Turso create/read/update/delete behavior with a temporary record that was removed afterward. Lint, TypeScript, and the webpack production build pass. Notes remains incomplete in TODO until the create/save/reload/delete flow is confirmed in the browser. Next: verify Notes at `/notes`; once confirmed, mark it complete and proceed to the v0 flat todo checklist.

## 2026-08-15 — Board home screen (v1 Today dashboard) implemented

Replaced the home screen's flat link list with a drag-to-rearrange, resizable board of Calendar/Inbox/Notes panels. Preceded by design work: a design doc (`docs/designs/2026-08-15-board-home-screen.md`) grounded in the actual v0 code, then two rounds of visual mocking — an initial whitespace-separated bullet-journal layout that read as flat, then a revision (after reviewing a reference widget-kit image for what makes something "feel like a component") to full hairline-bordered index-card panels with a headline stat, an oversized low-opacity watermark glyph, and a 7-dot week strip for Calendar — all still built from the existing dot-grid/hairline/glyph/mono design tokens, no cards-with-shadows creeping in.

Implementation: added a `layouts` table (single JSON row) for persisting panel position/size; split `lib/calendar/google.ts` into a server-only Google API module plus a new client-safe `lib/calendar/format.ts` for the pure date-formatting helpers, since the client-only board can't import anything that pulls in `googleapis`/`server-only`; added `react-grid-layout` (pinned to the 1.x line, verified its `GridItem.js` already passes `nodeRef` for React 19 safety before adopting); built a shared `panel-shell.tsx` plus three thin panel components; wired `app/page.tsx` to fetch all three summaries via one `Promise.all` (simpler than per-panel Suspense, and RGL needs all panels present as children at once anyway) and render the board.

Along the way: fixed `db:push`/`db:studio` hanging indefinitely against Turso — they weren't using the Homebrew CA bundle the way `dev`/`build`/`start` already did; generalized the wrapper into `scripts/with-local-ca.sh` to cover all of them. Also found and fixed a real bug via live browser testing (Chrome DevTools automation): resize wasn't working because `react-resizable`'s injected `children` prop (carrying the resize-handle element) was being silently shadowed by each panel component's own explicit JSX children when spread through `{...rest}` — fixed by moving row content to an explicit `rows` prop on `PanelShell`, freeing `children` for the injected handle to actually render. Confirmed in-browser afterward: drag and resize both work.

Added a "Design principle: KISS" section to `AGENTS.md` — the simple solution wins unless there's a concrete, stated reason it doesn't; the double-refresh code-review finding from earlier this session was resolved under this lens (left as-is, documented as an accepted tradeoff, rather than adding a split auth-config file for a narrow single-user race).

Lint and the production build pass; drag/resize verified live in the browser. Still open: confirm layout position/size actually persists across a reload, and a full visual pass in both light/dark system theme. Next: browser-verify Notes (carried over from the previous session), then the v0 flat todo checklist.

## 2026-08-15 — Notes and board persistence verified

Browser verification confirmed the Notes create/save/reload/delete flow works. Also confirmed that board panel positions and sizes persist across a page reload. Marked the v0 Notes slice complete and removed the Today dashboard's persistence-verification qualifier.

Still open for the board: a full visual pass in both light and dark system themes. Next development feature: the v0 flat todo checklist, followed by adding Todos to the home board.

## 2026-08-15 — v0 Todos and board panel implemented

Added a persistent `/todos` checklist with add, complete/reopen, and delete actions. Open items sort before completed items. Verified the Turso lifecycle with a temporary todo that was removed afterward. Added Todos as a fourth board component using the shared panel shell: it shows the open count, up to three open items, and links to the full checklist.

Existing persisted three-panel layouts are preserved; when the Todos panel is first encountered it is appended below the saved arrangement rather than resetting the user's positions. Recorded the new product convention that future user-facing features include a compact board component unless explicitly excluded. Lint, TypeScript, and the webpack production build pass. Todos remains unchecked until the full page and panel are browser-verified.

## 2026-08-15 — Todos moved entirely into the board

Removed the standalone `/todos` page and moved the complete add/check/reopen/delete workflow into the Todos board panel. The first add implementation felt unresponsive because it waited for Turso and revalidated `/`, which rebuilt the entire board and refetched Gmail and Google Calendar.

Changed Todos to update optimistically in local panel state, persist to Turso in the background, and roll back visibly if a write fails. Todo actions no longer revalidate unrelated home-page data. Updated the board-first convention: every feature gets a panel by default, while a separate full page is added only when the feature needs more space or depth. Lint, generated route types, and TypeScript pass. Browser verification remains pending.

## 2026-08-15 — Calendar page replaced with a FullCalendar week grid

Replaced the chronological `/calendar` event list with a Monday-starting FullCalendar time grid. The page still loads the primary Google Calendar on the server, but now displays the current Pacific-time week with timed and all-day events, a current-time indicator, and links back to the source event in Google Calendar. The compact Calendar board panel remains unchanged.

Aligned `@fullcalendar/react` with the existing FullCalendar 6.1.21 packages to avoid mixing major versions, and added styling that follows the app's existing ink, hairline, mono-type visual system. Lint, generated route types, TypeScript, and the webpack production build pass. Next: browser-check the grid, then add Google Calendar write persistence for drag-to-create, drag-to-move, and drag-to-resize.

## 2026-08-15 — Full week grid added to the Calendar board panel

Replaced the home Calendar panel's compact chronological summary with the same Monday–Sunday FullCalendar time grid used on `/calendar`. The board now receives the whole current week, preserves a practical minimum panel height, and keeps the full-page link for a larger view.

Added FullCalendar's official Luxon timezone adapter so `America/Los_Angeles` is interpreted explicitly rather than falling back to the browser's local Eastern timezone. The owner visually confirmed the board calendar looks correct. Lint, generated route types, TypeScript, and the webpack production build pass. Next: implement drag-to-create, drag-to-move, and drag-to-resize with Google Calendar persistence.

## 2026-08-15 — Calendar write interactions implemented

Enabled FullCalendar selection, dragging, and resizing on both the home-board and full-page week grids. Selecting an empty range prompts for a title and creates the event; moving or resizing an existing event patches its times on the primary Google Calendar. All three operations update local calendar state immediately, persist through authenticated server actions, and roll back with an inline error if Google rejects the write.

The existing OAuth scope already grants Calendar writes, so no additional consent change was required. Lint, generated route types, TypeScript, and the webpack production build pass. Browser verification against the owner's Google Calendar remains before this task is marked complete.

## 2026-08-15 — Calendar week navigation and horizontal scrolling added

Added previous, today, and next controls to both FullCalendar surfaces. Changing weeks now loads that exact visible range from the primary Google Calendar through an authenticated server action; a request counter prevents a slower prior response from overwriting a newer week when navigating quickly. Loading and failure states appear beneath the grid.

Gave the seven-day calendar a fixed minimum canvas width inside a horizontally scrollable container, with a slightly denser minimum on the board panel. Narrow panels now scroll instead of crushing day columns. Lint, generated route types, TypeScript, and the webpack production build pass. Browser verification remains pending alongside the Calendar write interactions.

## 2026-08-15 — Inbox board panel made scrollable

Stopped truncating the home-board inbox digest to three messages and passed the complete bounded unread/24-hour Primary result into the panel. The message region now scrolls vertically when the resized panel cannot display every row, while its header, count, and footer remain fixed. Lint, TypeScript, and the diff whitespace check pass.

## 2026-08-15 — Inline utility styling moved to CSS Modules

Replaced the long Tailwind utility strings in the home, sign-in, inbox, calendar, notes-list, note-detail, and note-editor JSX with semantic classes from colocated CSS Modules. Moved the remaining small board-only utility styles into a board module and moved root layout sizing and font smoothing into global element rules. Existing shared semantic hooks such as `ink-action`, `panel-row`, and FullCalendar integration classes remain intentionally global.

Removed the obsolete global Tiptap rules after moving editor prose styling beside `NoteEditor`, and recorded the CSS organization convention in `AGENTS.md`. Lint, TypeScript, the diff whitespace check, and the webpack production build pass.

## 2026-08-15 — Embedded Excalidraw diagrams implemented in Notes

Added one note-owned Excalidraw canvas directly below the Tiptap body. Notes without a canvas show an "Insert diagram" action; creating it uses the existing `diagrams` table, and subsequent scene changes save to Turso after a 700 ms debounce with saving/error status. Existing scenes load with the note, diagrams can be removed independently, and deleting a note now removes its linked diagram first.

Kept Excalidraw browser-only through a dynamic client import and stored a deliberately small JSON scene shape: elements, binary files, canvas background, and grid size. Lint, generated route types, TypeScript, and the webpack production build pass. Browser verification of insert/draw/reload/remove remains before the TODO is marked complete.

## 2026-08-15 — Homepage note deletion, top-left navigation, and responsive route loading

Added optimistic note deletion to the home Notes panel, including linked-diagram cleanup, confirmation, count updates, and rollback feedback. Moved the Home action into a consistent top-left navigation row on Inbox, Calendar, Notes, and note-detail pages while preserving page-specific actions.

Investigated slow navigation. The primary cause is blocking server work with no loading boundary: Home waits for fresh Gmail IMAP and Google Calendar requests plus Turso queries; Inbox and Calendar each repeat their external request. Added a root `loading.tsx` spinner so client navigation commits immediately while destination data loads. The next performance step, if needed, is to stream the slow Inbox and Calendar home panels independently and optionally add a short single-user cache for their reads. Lint, generated route types, TypeScript, whitespace checks, and the webpack production build pass.

## 2026-08-15 — Dashboard data loading and caching optimized

Removed Gmail and Google Calendar from the home page's blocking server `Promise.all`; the board now renders after only its fast Turso reads, while Inbox and Calendar load independently inside their existing panels. Added browser-session caches so returning Home immediately restores the last panel data, plus 60-second server snapshots that serve stale data while starting a background refresh. Concurrent refreshes are coalesced to avoid duplicate IMAP or Google requests.

Added Refresh controls to Inbox and Calendar panels. The full Inbox and Calendar pages reuse the same server snapshots, while Calendar writes clear the server event cache. This intentionally uses small single-user caches rather than adding Redux/API-route architecture. Lint, generated route types, TypeScript, whitespace checks, and the webpack production build pass.

## 2026-08-21 — Flat note folders implemented

Added durable flat folders to Notes. The Notes page now has a left sidebar for All Notes, Unfiled, and alphabetized folders, including inline folder creation plus rename and permanent deletion. Deleting a folder warns with its note count and cascades through its notes and linked diagrams. Creating a note inside a selected folder assigns it immediately; the note editor can move a note between folders or back to Unfiled.

Existing notes remain Unfiled through the migration. The home Notes panel continues to show recent notes across every folder and now identifies each note's folder. Applied the schema to Turso and verified lint, generated route types, and TypeScript. The production compiler started successfully but remained active long enough that a second verification build was blocked by Next.js's build lock.

## 2026-08-21 — Notes navigation changed to an IDE-style explorer

Replaced the folder-filter sidebar with a compact Notes Explorer. It has distinct new-note and new-folder toolbar actions, disclosure arrows for expanding and collapsing folders, notes nested visibly beneath their folder, and Unfiled represented as the root destination. Notes can be dragged between folders or onto Unfiled, with the move persisted immediately through the existing server action.

Kept the underlying one-level folder model unchanged: the explorer has tree interaction without implying that folders can nest yet. Folder rename and destructive delete remain available as row actions. ESLint, generated route types, and TypeScript pass; production-build verification remains blocked by the earlier lingering Next.js build lock.

## 2026-08-21 — Note writing now autosaves

Removed the manual Save button from the note editor. Title and Tiptap document changes now persist after 700 ms without another edit, with visible Unsaved changes, Saving, Saved, and failure states. Save requests are serialized so an older slow request cannot finish after and overwrite newer content, and successful saves no longer refresh the route or interrupt typing.

The existing Excalidraw canvas retains its own debounced persistence. ESLint, generated route types, TypeScript, and whitespace validation pass.

## 2026-09-14 — Plaid finance integration researched

Researched Plaid's current Link, Transactions, Liabilities, Balance, Statements, webhook, OAuth, security, Production-access, and billing documentation against Bradley OS's existing Auth.js and Turso architecture. Saved the findings in `docs/designs/2026-09-14-plaid-integration-research.md`; no application code or product scope was changed.

Recommended starting with Transactions only: it covers bank and credit-card activity plus cached balances without exposing routing/account numbers or enabling money movement. Liabilities can be added later for card due dates, minimum payments, statement balances, and APRs; literal PDF Statements and paid real-time Balance calls are unnecessary unless a specific widget requires them.

The current billing docs say teams created on or after April 15, 2026 can use a free Trial with 10 lifetime Production Items, which could cover a single user for $0, but Plaid's public pricing page still describes a conflicting 200-call Limited Production allowance. The Dashboard or Plaid support must confirm the actual account terms and paid per-Item rates before live linking. Security work remains before Production: keep provider tokens server-only, encrypt Plaid access tokens outside the database trust boundary, directly enforce the owner email on finance data access, verify signed webhooks, disable finance caching, add security headers, and document the currently unknown HTTPS deployment boundary.

## 2026-09-14 — Finance widgets product spec written

Researched how often Plaid connections need credential refresh from Plaid's own docs (Items and OAuth guide): access tokens do not expire; re-authentication is event-driven (changed credentials, expired one-time passcodes, user revocation at the bank, and consent expiration at a small set of institutions — mostly 12 months, Brex 3 months, Chase user-chosen 6 months/1 year/"always", Europe ~180 days). Plaid fires a PENDING_DISCONNECT webhook one week before consent expires, so the app can prompt repair in advance; update mode resets the expiration. This confirmed that Bradley OS should never prompt for re-login on its own schedule.

Competitor research on app-session persistence (Monarch, YNAB, Copilot, Empower) found no published idle/absolute session limits anywhere; all treat bank connections as a separate lifecycle from dashboard login. This is not a coincidence to engineer around — it validates keeping app sessions and Plaid connections fully independent.

Wrote `docs/designs/2026-09-14-finance-widgets-product-spec.md`: non-technical spec for the Bank Accounts and Credit Cards home-board widgets plus the connection lifecycle. Covers combined/per-account balances, five most recent transactions, per-card tabs, in-widget connect/repair/disconnect, automatic updates with a visible last-updated time, and the confirmed principle that repair prompts fire only when the bank/connection service signals a broken or expiring connection. Recorded security NFRs (no bank credentials in the app, masked identifiers only, no browser caching of financial data, data purged on confirmed disconnect). Out of scope: due dates/minimum payments/APRs, PDF statements, budgeting, money movement, and transaction history beyond five per view.

Three open questions remain in the spec: bank-widget transaction scope (five combined vs. per account), retained history depth, and exact app-session durations (research recommends 24-hour maximum + 30-minute idle; app sessions only, never connections). TODO.md updated; no application code changed.

## 2026-09-14 — Finance widgets high-level technical design written

Wrote `docs/designs/2026-09-14-finance-widgets-high-level-design.md`, grounded in the actual codebase (server-action patterns, `proxy.ts` matcher, `board-client.tsx` layout resolution, `PanelShell`, schema conventions). It specifies three new Drizzle tables (`plaid_items`, `financial_accounts`, `financial_transactions`) using Plaid's own IDs, a server-only `lib/plaid/` module set (client, crypto, sync, webhook verification), `app/actions/finance.ts` server actions, and a single unauthenticated `app/api/plaid/webhook/route.ts` with a narrow `api/plaid` proxy exclusion.

Key decisions: no queue/cron (webhook marks items dirty; sync runs on board load, manual refresh, or after repair); webhook does no sync work; amounts stored as REAL; no category/merchant columns until a widget needs them; AES-256-GCM token encryption with the key outside Turso; `PENDING_DISCONNECT` (one week before consent expiry) drives the only repair prompts; disconnect calls `/item/remove` before purging local rows. Prerequisite security items carried in from the research doc: stop exposing `googleAccessToken` via the session callback, harden `requireOwner()` to check the owner email directly, CSP for `cdn.plaid.com` in the currently-empty `next.config.ts`.

Two recommendations for the spec's open questions: 730-day Plaid history window (chosen at first link; increasing later requires relinking, so maxing out now is free), and the bank widget's five transactions shown combined across accounts. Effort estimate from the research doc: ~10-16 engineering days production-ready, sandbox demo 2-3 days.

## 2026-09-14 — Finance widgets low-level design written

Wrote `docs/designs/2026-09-14-finance-widgets-high-level-design-lld.md` from the finance widgets HLD (user confirmed the HLD as the target since two 2026-09-14 docs were candidates). The LLD pins the mechanisms the HLD left open: a `dirty` boolean column on `plaid_items` for the webhook→sync handoff; webhook verification via `jose` (already in the tree via next-auth) with per-`kid` JWKS fetch and an injectable fetch for tests; AES-256-GCM token ciphertext as a versioned `v1:nonce:ct:tag` string; one-transaction cursor writes in the sync engine; duplicate-Item handling that removes the new token and returns the existing item; snapshot queries including a single `ROW_NUMBER()` window query for per-card top-5; and a static CSP in `next.config.ts` with the `'unsafe-inline'` weakening stated honestly.

Two derived choices were recorded in `docs/decisions.md`: Vitest as the first test framework (node env, in-memory libsql, mocked at the `lib/plaid/client` seam), and the board-load dirty-sync trigger implemented as a post-mount client call to a `syncDirtyItems()` action rather than an in-request fire-and-forget, which can be frozen on serverless hosts. The HLD's `fire-and-forget` phrasing is pinned onto that reliable transport; triggers stay connect / board-load / manual refresh / post-repair.

One factual discrepancy surfaced against the HLD: its schema comment says transaction amounts store "negative = outflow (matches Plaid)", but Plaid's convention is positive = money out, negative = money in. Storage is unaffected; the LLD pins the real convention and flags the HLD line for correction.

No application code changed. TODO.md unchanged — the LLD refines the existing finance tasks rather than adding new ones.

## 2026-09-17 — Owner authorization hardened

Updated the shared `requireOwner()` guard to compare the authenticated session email directly with the configured `OWNER_EMAIL`, case-insensitively, before allowing protected work. The guard now fails closed for a missing configured owner, missing session/email, or a different identity; its existing no-return success contract and `Unauthorized` error remain unchanged, so all Notes, Todos, layout, Inbox, search, and future finance callers gain the stronger check without call-site changes.

Added the focused Vitest coverage required by the finance LLD: no session rejects, a different email rejects, and the configured owner passes despite casing and surrounding environment-variable whitespace. The focused test, full 4-test suite, and ESLint pass. T10 is complete; the remaining pre-live security tasks are T11, T12, and T34.

## 2026-09-17 — Static security headers added

Configured application-wide security headers in `next.config.ts`: a restrictive default CSP with Plaid Link limited to `cdn.plaid.com` for scripts/frames and `*.plaid.com` for connections, `frame-ancestors 'none'`, HSTS, `X-Content-Type-Options: nosniff`, and `Referrer-Policy: strict-origin-when-cross-origin`. The LLD's accepted static-policy tradeoff remains explicit in behavior: Next hydration retains `'unsafe-inline'`; local development alone also allows `unsafe-eval` and WebSockets because React debugging and Turbopack HMR require them.

Production/development config assertions, ESLint, the full 4-test Vitest suite, and whitespace validation pass. The production bundle compiles and loads the config successfully, but its TypeScript phase remains blocked by pre-existing Auth.js mock typing errors in `lib/auth/require-owner.test.ts`; recorded as T35 instead of expanding T11. T11 is complete. Next security implementation task: T12.

## 2026-09-18 — Finance schema applied to Turso

Applied generated migration 0003's finance schema to the production Turso database after restoring the database URL and auth token locally. Drizzle reported that the changes were applied successfully; T9 no longer has a pending database-push step.

## 2026-09-18 — Plaid SDK client added

Added the server-only `lib/plaid/client.ts` seam for all future Plaid backend calls. `getPlaidClient()` lazily validates the client id, secret, and exact Sandbox/Production environment, configures the official SDK's base URL and credential headers, and reuses one process-local `PlaidApi` instance. T13 makes no network request and keeps future Plaid SDK mocking behind one module boundary.

Focused ESLint and all four Vitest tests pass. TypeScript reaches only the already-tracked T35 Auth.js test-mock errors and reports no error in the new module.

## 2026-09-18 — Auth.js test mock build blocker fixed

Narrowed the overloaded Auth.js `auth` mock in `lib/auth/require-owner.test.ts` to its zero-argument `Promise<Session | null>` signature. Vitest had executed the mock correctly, but TypeScript inferred Auth.js's middleware overload and rejected the test's null and session return values during production builds.

The focused test, full four-test suite, focused and full ESLint, and `tsc --noEmit` pass. The production build also completes when supplied the required auth environment variables; without them, this checkout now gets past the fixed TypeScript phase and stops later because its local `.env` lacks `OWNER_EMAIL`, which is separate from T35.

## 2026-09-18 — Plaid access-token encryption added

Added the server-only `lib/plaid/crypto.ts` boundary for encrypting Plaid access tokens at rest. It validates `FINANCE_ENCRYPTION_KEY` as exactly 32 bytes encoded in hex, uses a fresh 12-byte nonce with AES-256-GCM, stores the nonce/ciphertext/16-byte authentication tag in the pinned `v1` string format, and rejects malformed envelopes, unknown versions, wrong keys, and authenticated-data tampering before returning plaintext.

Added 11 focused Vitest cases covering format and roundtrip behavior, nonce freshness, ciphertext/tag tampering, wrong/missing/malformed keys, malformed payloads, and unknown versions. The focused and full 15-test suites, ESLint, and `tsc --noEmit` pass. The production build also passes with non-secret placeholder auth values; without them, it reaches the existing `OWNER_EMAIL` page-data requirement after compiling and typechecking successfully. T14 is complete; future finance actions and sync work will own persistence and Plaid calls.

## 2026-09-18 — Plaid sync engine added

Added the server-only `lib/plaid/sync.ts` primitive (T15). `runItemSync(itemId)` loads the item's stored cursor, decrypts its access token through the T14 boundary, pages `/transactions/sync` (count 100) into memory while `has_more`, and then applies one atomic Drizzle transaction: chunked upserts for added and modified transactions, chunked deletes for removed IDs (applied after upserts so removal wins), balance and metadata refreshes for accounts present in the response (owner-accepted partial-refresh decision recorded in docs/decisions.md), and the final cursor, `lastSyncAt`, `dirty = false`, and status healing in the same commit. Any mid-pagination Plaid failure aborts before any write; a recognized auth failure (`ITEM_LOGIN_REQUIRED`, `INVALID_CREDENTIALS`, or a stored OAuth `error_code_reason`) additionally marks the item `needs_attention` through a separate minimal update that preserves the cursor, dirty flag, and `lastSyncAt`, then rethrows the original error.

Added `lib/plaid/sync.test.ts` (10 focused cases: staged multi-page reconciliation with balance and ISO-currency assertions, cursor rollback on a mid-pagination error, idempotent replay, table-driven auth-error mapping, transient-error no-op, post-repair healing, and unknown-item fail-fast) against the test harness with the Plaid client mocked at the existing seam and real token encryption/decryption through T14.

The harness itself changed: `createInMemoryDb` became `createTestDb`, backed by a per-database temp file instead of `:memory:`. The local `@libsql/client` driver parks its connection while a transaction is open and lazily opens a fresh connection afterward; with `:memory:` that fresh connection is an empty database, so any query after a committed transaction failed with "no such table" (caught by the sync tests, isolated with a probe, fixed in the harness). A regression test in `test-harness.test.ts` covers transaction-then-read, and AGENTS.md's testing-approach line was updated to match.

The full 26-test suite, ESLint, and `tsc --noEmit` pass. Next: T16 (snapshot reads) or T17 (webhook verification); T20/T21 will own calling the sync engine.

## 2026-09-19 — Finance snapshot reads added

Added the server-only `lib/plaid/snapshot.ts` read model (T16). `getFinanceSnapshot()` returns only the account, recent-transaction, connection-status, and freshness fields needed by the future finance panels; access tokens, cursors, and other private persistence fields never cross the boundary. The reader computes the depository combined balance, selects the deterministic five newest transactions across all depository accounts, uses one SQLite `ROW_NUMBER()` window query for the five newest transactions per credit card, includes cards with no transactions, and derives each widget's `lastSyncAt` only from Items that own that account type. It performs local Turso reads only and never contacts Plaid.

Added `lib/plaid/snapshot.test.ts` with empty-state and multi-Item coverage for nullable balances, account grouping, stable transaction ordering and limits, empty cards, item repair metadata, and separate widget freshness. The full 28-test suite, ESLint, `tsc --noEmit`, and the production build pass; the build used non-secret placeholder auth values because the local `.env` omits `OWNER_EMAIL`. T16 is complete. Next: T17 (webhook verification) or T19 (link-token actions); T20/T21 will consume the snapshot reader.

## 2026-09-20 — Plaid webhook route added

Added `app/api/plaid/webhook/route.ts` (T18), the app's one unauthenticated route. POST-only (only export, so Next answers 405 for every other method); reads the untouched raw body via `request.text()`; rejects with 413 when `content-length` exceeds 10,000 bytes and again after reading for chunked/lying headers; verifies Plaid's `Plaid-Verification` JWT through T17's `verifyPlaidWebhook` and answers 401 with an empty body on any failure. Verified webhooks apply one conditional `UPDATE` on `plaid_items` per the LLD §6.12 transition table (transactions codes set `dirty`; `ERROR` stores the error code; `PENDING_EXPIRATION` stores `consentExpiresAt`; `PENDING_DISCONNECT` flags attention without touching expiry; `LOGIN_REPAIRED` heals the item). Unknown items, unrecognized codes, and unparseable expiry values still get 200 — Plaid retries non-2xx and would loop forever on a dead `item_id` — with a minimal `console.log` of type/code/item only (no amounts, names, or tokens). The proxy matcher now excludes `api/plaid` alongside `api/auth`.

Fixed a latent T17 bug found while writing the route: `verifyPlaidWebhook` passed Plaid's raw `error` object through, so the typed `error.errorCode` was never populated from the real snake_case `error.error_code` payload field. It now maps `error_code` into `errorCode`, and the pass-through test in `lib/plaid/webhook.test.ts` uses the real payload shape.

Added `app/api/plaid/webhook/route.test.ts` with 12 focused cases: POST-only exports, 401 with no state change, dirty marking, duplicate delivery as a no-op (row compared minus `updatedAt`), unknown item creates nothing, the four status transitions, unrecognized-code no-op, and both 413 paths (oversized body; lying `content-length`) confirmed to skip JWKS fetch entirely. The full 48-test suite, ESLint, and `tsc --noEmit` pass. Next: T19 (link-token actions) or T12 (server-only Google token); T20/T21/T22/T23 unblock behind T19.

## 2026-09-20 — Link-token actions added

Added `app/actions/finance.ts` (T19), the first two server actions of the finance set. `createLinkToken()` builds the connect-mode token per LLD §6.10: `products: ["transactions"]`, `country_codes: ["US"]`, `client_user_id: "bradley-os-owner"`, `transactions.days_requested: 730` (the OQ2 history window, fixed at first link), and `webhook`/`redirect_uri` only when `PLAID_WEBHOOK_URL`/`PLAID_REDIRECT_URI` are set in env (currently commented out in `.env`). `repairItem(itemId)` loads the item row, decrypts its stored access token through the T14 boundary, and builds an update-mode token carrying `access_token`; `products` stay omitted per Plaid's update-mode guidance so re-auth cannot initialize a new product. Both actions begin with the hardened `requireOwner()` and throw on failure (unknown item, decryption failure, Plaid error), matching the existing actions' error convention.

Added `app/actions/finance.test.ts` with 8 focused cases: the pinned connect-mode request shape (exact key set, 730-day window, no webhook/redirect keys when unset), env-conditional webhook/redirect inclusion, owner-gate ordering on both actions (Plaid and DB untouched on rejection), Plaid-failure propagation, update-mode token bound to the decrypted access token, unknown-item throw without a Plaid call, and decryption-failure propagation. Tests follow the established seams: Plaid client mocked at `lib/plaid/client`, owner check mocked at `lib/auth/require-owner`, real T14 crypto with the test key stubbed, and the per-test libsql harness injected through the `lib/db/client` seam. The full 56-test suite, ESLint, and `tsc --noEmit` pass. Next: T20 (exchangePublicToken, first consumer of T19), or T12 in parallel; T21–T23 unblock behind T20.

## 2026-09-22 — Google access token removed from the session (T12)

Stopped exposing `googleAccessToken`/`googleTokenError` through the Auth.js session object per LLD §6.11. The `session` callback is deleted (the default callback now serves `user`/`expires` only, so `/api/auth/session` and every client-exposed session carry no provider tokens), and `types/next-auth.d.ts` drops both fields from the Session interface while the JWT interface keeps them inside the encrypted cookie. `auth.ts` now exports `authSecret` (a `requireEnv("AUTH_SECRET")`) so the token reader shares the exact secret instead of re-reading env.

New server-only `lib/auth/google-token.ts` reads the JWT through `getToken()` from `next-auth/jwt`: it picks the session cookie by exact name (`authjs.session-token` or `__Secure-authjs.session-token`, which Auth.js also uses as the HKDF salt), decodes with the shared secret, and returns `{ accessToken, error }`. A thin `getGoogleToken()` wrapper feeds it `headers()` from next/headers; the Headers-taking core is exported as the test seam (same injectable-parameter pattern as the webhook verifier). Both calendar consumers (`app/actions/calendar.ts` `requireCalendarAccess`, `app/calendar/page.tsx`) switched to it; calendar behavior is otherwise unchanged.

The focused test caught a real bug before it shipped: picking the cookie with a substring check made `__Secure-authjs.session-token=...` match the unprefixed name too, so the secure-cookie case decoded against the wrong store and returned nulls. Exact name matching fixed it. `lib/auth/google-token.test.ts` covers: no cookie, unrelated cookies, unprefixed and `__Secure-` reads, the refresh-error flag, and an undecryptable cookie, using real `encode`/`getToken` round-trips with the `@/auth` seam mocked (no JWT-mock fragility).

One verified nuance, accepted and recorded: `getToken()` only decodes — it does not run the `jwt` callback. Refresh still happens on every request in the proxy middleware, which refreshes 60 seconds before expiry (so continuous use is seamless), but the one request that crosses the expiry threshold still renders with its pre-refresh cookie. After a long idle period the first calendar render can therefore show the self-healing "could not reach Google Calendar — refresh to try again" state once; `auth()`-based reads refreshed in-request and never showed it. If that blip proves annoying in practice, a small follow-up can trigger the same refresh in `readGoogleToken` when the decoded `googleAccessTokenExpiresAt` is past.

The full 62-test suite, ESLint, and `tsc --noEmit` pass (full build remains blocked in this checkout by missing Turso env, same as a clean tree). Next: T20 (exchangePublicToken — the critical path), or T23/T24/T28/T34 in parallel.

## 2026-10-03 — Public-token exchange action added (T20)

Added `exchangePublicToken(publicToken)` to `app/actions/finance.ts`, the first consumer of T19's flow. Per LLD §5.1/§6.8 it: exchanges the public token via `/item/public_token/exchange`, reads institution metadata (`/item/get`), fetches accounts and balances (`/accounts/get`), then checks for an existing `plaid_items` row with the same `institution_id` — on a duplicate it calls `/item/remove` on the newly exchanged token (no local writes) and returns the existing item's id; otherwise it stores the item (access token encrypted through T14) plus its accounts in one Drizzle transaction, runs the initial sync through `runItemSync` (T15), and returns the new item's id. The LLD's accounts-get-before-duplicate-check ordering is followed as written. Institution metadata absence throws before any write (Plaid only omits it for non-Link items, so it means the flow is broken). A first-sync failure propagates after `runItemSync` marks the item `needs_attention` for auth-class errors, per invariant S1.

Added 6 focused cases to `app/actions/finance.test.ts`: the full happy path (call order, encrypted-token roundtrip, account mapping including nullable mask/subtype/balance and the USD currency fallback for the notNull column, initial-sync cursor), the duplicate branch (remove called on the new token, no local writes, existing id returned), owner-gate ordering, exchange-failure propagation, missing-institution-metadata throw, and first-sync failure leaving the stored item `needs_attention`. The full 68-test suite, ESLint, and `tsc --noEmit` pass. Next: T21 (sync trigger actions) or T23/T24/T28/T34 in parallel.

## 2026-10-03 — Sync trigger actions added (T21)

Added the three sync-trigger server actions to `app/actions/finance.ts`, per LLD §4.1/§5.6/§6.4. `syncDirtyItems()` selects items with `dirty=1` and syncs each, swallowing per-item failures so it never throws to the client (a failed item stays dirty for the next board load; auth errors were already handled inside `runItemSync`). `syncNow()` selects every `status='healthy'` item regardless of `dirty`, propagates failures, and skips needs-attention items whose data cannot move until repair. `syncItem(itemId)` runs the same sync for exactly one item with no status filter — the post-repair path where a successful sync is what heals it — and all three return `getFinanceSnapshot()` fresh from Turso. The board's post-mount effect and the panels' refresh/repair callbacks will consume them in T23/T25–T27.

Added 9 focused cases to `app/actions/finance.test.ts` (dirty-only selection with per-item token assertions, failure-swallowing on dirty sync, healthy-only manual refresh skipping needs_attention, failure propagation on syncNow, post-repair sync of a needs_attention item, unknown-item throw, and owner gates) with the snapshot reader mocked at its module seam. The full 77-test suite, ESLint, and `tsc --noEmit` pass. Next: T22 (disconnectItem) or T23/T24/T28/T34 in parallel.

## 2026-10-03 — Disconnect action added (T22)

Added `disconnectItem(itemId)` to `app/actions/finance.ts`, completing the server-action set. Per LLD §5.5 it removes the item at Plaid first (`/item/remove` with the decrypted token) and only then deletes the `plaid_items` row, letting the schema's cascade purge accounts and transactions (NFR-1.5). Any Plaid failure throws with nothing deleted so the billed Item stays removable; an `ITEM_NOT_FOUND` response is treated as success so a retry after a failed local purge can finish the cleanup (§7). The unknown-item row miss throws the same `Plaid item not found: <id>` message `repairItem` uses. `getPlaidError` in `lib/plaid/sync.ts` was exported so the action reuses the existing Axios-error-shape extractor instead of duplicating it.

Added 5 focused cases to `app/actions/finance.test.ts` (happy path with an account row proving the cascade purge, Plaid rejection keeping all rows, ITEM_NOT_FOUND retry completing the purge, unknown item without a Plaid call, owner gate). The full 82-test suite, ESLint, and `tsc --noEmit` pass. Backend actions are now complete; next: T23 (PlaidLinkLauncher) and T24 (shared panel pieces), then the two panels T25/T26.

## 2026-10-04 — PlaidLinkLauncher added (T23)

Added `components/board/plaid-link-launcher.tsx` plus its two siblings. Per LLD §6.9 the launcher mounts a button and a state machine (idle → fetch token → Link open → exchange → `onConnected(itemId)`); on any failure it resets to idle with an inline error so the user simply re-clicks. Connect mode calls `createLinkToken()`, repair mode `repairItem(itemId)` — the union prop type makes `itemId` required exactly when `mode === "repair"`. The token is fetched per click, never cached (link tokens expire ~30 min, public tokens are single-use).

The actual Link UI lives in `components/board/plaid-link-opener.tsx`, dynamically imported with `next/dynamic(..., { ssr: false })` — the same client-only pattern as Excalidraw — so `react-plaid-link` never loads on the server. It's mounted only while a fresh token exists, calls `usePlaidLink({ token, onSuccess, onExit })` and opens Link when ready; unmounting destroys the Link UI, and the hook's script-load `error` surfaces as the launcher's "couldn't load" state (the CSP/CDN failure path in LLD §7). On success the launcher calls `exchangePublicToken` itself (both panels need identical exchange behavior) and hands the resulting `itemId` to the panel via `onConnected`. Exit is a no-op per the failure table.

Styling is a small colocated module (`plaid-link-launcher.module.css`): the button reuses the global `ink-action` class with disabled-state overrides, and an uppercase mono error line in `--error`. No tests added — LLD §8's mapping has no client-component coverage and existing panels have none either. Deliberately skipped: `receivedRedirectUri` for OAuth institutions, which only matters behind the production HTTPS boundary (TODO T32, unresolved).

Full 82-test suite, ESLint, and `tsc --noEmit` pass. Next: T24 (shared panel pieces: transaction-row, connection-status row, finance.module.css), then T25/T26.

## 2026-10-04 — Shared finance panel pieces added (T24)

Added the three shared pieces both finance panels reuse. `components/board/transaction-row.tsx` renders one `TransactionView` as a standard `panel-row` (name + date sub-line left, amount right). Per LLD §6.14 the amount is formatted with `Intl.NumberFormat("en-US", { style: "currency", currency })` client-side: stored negative = money in → absolute value with an explicit `+` prefix in `--accent`; stored positive = money out → plain. Pending rows get a small bordered "pending" chip under the amount (FR-1.4/2.4). Plaid dates are `YYYY-MM-DD`, parsed as UTC (`T00:00:00Z`) so the short-form date (e.g. "Oct 2") never shifts a day under a local timezone.

`components/board/connection-status-row.tsx` renders one line per institution (name + "Connected" / "Needs attention (ERROR_CODE)") with a status dot — accent when healthy, `--error` when not. It takes the flattened `{ institutionName, status, lastErrorCode }` shape rather than `ItemView` directly, so the panels decide what to pass (and "disconnected" stays the panels' empty state, not a row). The HLD names this piece; the LLD file tree didn't list it, so it lives next to the launcher as `connection-status-row.tsx`.

`components/board/finance.module.css` holds the shared styles (amount cell, pending chip, status dot) using the existing tokens; panels will add their own classes to it in T25/T26. No tests added — same reasoning as T23 (client presentation, LLD §8 covers backend only).

Full 82-test suite, ESLint, and `tsc --noEmit` pass. Next: T25 (bank-accounts-panel) and T26 (credit-cards-panel), both depend on T23 + T24.

## 2026-10-04 — Formatting helpers extracted to lib/finance/format.ts

Per the no-god-files principle, moved `formatDate`/`formatAmount` (plus the UTC date formatter) out of `transaction-row.tsx` into a new pure module `lib/finance/format.ts`, following the `lib/calendar/format.ts` precedent (client-safe, no server deps). Exported as `formatTransactionDate` and `formatMoney` to avoid generic-name collisions at import sites; the component now imports them. The panels' combined-balance stat in T25 will reuse `formatMoney`. Lint, tsc, and the 82-test suite still pass.

## 2026-10-04 — Bank Accounts panel added (T25)

Added `components/board/bank-accounts-panel.tsx`, the first consumer of the launcher and shared pieces. PanelShell-based with glyph "$", "Bank Accounts" title, combined-balance headline stat (FR-1.1). Takes the whole `FinanceSnapshot` as a prop (LLD §5.7.2; T27 wires it from page.tsx). Rows: one connection-status row per item owning ≥1 depository account (join accounts→items per §4.2) with per-connection Repair (needs_attention only, via `PlaidLinkLauncher` update mode) and Disconnect actions; per-account rows showing `name ••mask` + signed balance (overdrafts render negative — added `formatMoney` as the signed variant since the original helper was abs-only); then a "Recent activity" section label + the five most recent transactions via `TransactionRow` (FR-1.2/1.3). Empty state shows "No bank accounts connected." with the connect launcher (FR-1.5). Footer shows "Updated …" (`formatLastUpdated`, absolute time in app timezone so there is no hydration mismatch) + Refresh (FR-1.6/FR-4.3), plus inline action errors.

Mutations follow the todos-pattern with one wrinkle: connect/repair actions return only `itemId`, and `disconnectItem` returns void, so the panel reconciles with a fresh snapshot via `syncItem(itemId)` (connect/repair — post-repair sync is the healing step per §5.4) and `syncDirtyItems()` (disconnect — a pure read when nothing is dirty, and the app's only client-facing "current snapshot" action). Disconnect is optimistic (accounts + item rows removed locally, combined balance recomputed) with rollback on failure, after a `window.confirm` (FR-3.5, same pattern as note deletion). One accepted limitation: `TransactionView` has no `accountId`, so the optimistic disconnect leaves the disconnected item's transactions in `recent` until the follow-up `syncDirtyItems()` reconcile — a momentary artifact, not stale persistence.

Also: `lib/finance/format.ts` gained `formatTransactionAmount` (abs, renamed from `formatMoney`), `formatMoney` (signed, for balances), and `formatLastUpdated`; `transaction-row.tsx` updated to the new name; `connection-status-row.tsx` gained an `action` slot for the per-connection affordances. The LLD §5.7.3 single post-mount `syncDirtyItems()` effect is deliberately NOT in the panel (once per page load, not per panel) — it lands in board-client.tsx with T27.

Full 82-test suite, ESLint, and `tsc --noEmit` pass. Next: T26 (credit-cards-panel, same wiring), then T27 (board wiring + post-mount sync effect + DEFAULT_LAYOUT/resolveLayout append).
