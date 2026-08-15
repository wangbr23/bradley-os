# Decisions

Append-only log of architecture decisions. One entry per decision, newest at the bottom. Don't edit past entries — a reversed decision gets a new entry that supersedes the old one, rather than an edit.

## 2026-08-15 — Record architecture decisions

**Status:** Accepted

**Context:** We need a lightweight way to record why significant technical decisions were made, so future work — by any contributor, human or AI, in any tool — doesn't rediscover or accidentally reverse them without knowing the original reasoning.

**Decision:** We will keep architecture decisions in `docs/decisions.md`, one entry per decision, appended chronologically. Entries are append-only — a changed decision gets a new entry that supersedes the old one, rather than an edit.

**Consequences:** Decisions and their reasoning survive context resets, tool switches, and contributor turnover.

## 2026-08-15 — Use stateless Auth.js sessions with Google Calendar tokens

**Status:** Accepted

**Context:** Bradley OS needs single-user Google authentication now and Google Calendar API access in the next v0 slice. Calendar access tokens expire, and no local user/account tables are planned.

**Decision:** Use Auth.js JWT sessions with the Google provider, enforce the `OWNER_EMAIL` allowlist during sign-in, request offline Calendar access, and keep the Google access token, refresh token, and expiry in the encrypted session token. Refresh expired access tokens through Google's token endpoint.

**Consequences:** Authentication and Calendar authorization share one consent flow without adding account tables. The app must continue protecting its Auth.js secret, and Google Testing-mode refresh tokens may require re-consent after seven days.

## 2026-08-15 — Standardize development on Node.js 24 LTS

**Status:** Accepted

**Context:** The machine was running EOL Node.js 20 and could not validate Google's current TLS certificate chain. The Homebrew CA bundle validates the chain correctly.

**Decision:** Pin Bradley OS to Node.js 24 LTS. Local Next.js scripts use Homebrew's CA bundle when it exists and otherwise leave the environment's native certificate configuration unchanged.

**Consequences:** Local Google OAuth and build-time font downloads work without disabling TLS verification. Developers need Node.js 24; Vercel and non-Homebrew environments keep their own trust configuration.

## 2026-08-15 — Keep the Gmail integration read-only and ephemeral

**Status:** Accepted

**Context:** Bradley OS needs a daily signal view of recent unread mail, not another mail client or a second mail database.

**Decision:** Connect to Gmail with ImapFlow and the owner's App Password, open INBOX read-only, and fetch at most 50 unread messages from the last 24 hours on request. Fetch only bounded preview data and message metadata; do not store messages locally or expose mail credentials to client code.

**Consequences:** Viewing the digest cannot mark mail read or mutate Gmail, and there is no local synchronization state to maintain. Every page load depends on Gmail availability and incurs a fresh IMAP connection; richer mail actions remain outside v1 scope.

## 2026-08-15 — Limit the inbox digest to Gmail Primary

**Status:** Accepted

**Context:** Gmail's IMAP `INBOX` contains Primary, Promotions, Social, Updates, and Forums. Showing every category made the digest noisier than the daily signal view Bradley OS is intended to provide.

**Decision:** Add Gmail's `category:primary` raw-search filter alongside `is:unread` and `newer_than:1d`, followed by the existing exact 24-hour cutoff.

**Consequences:** Promotions and other categorized inbox mail no longer appear in Bradley OS even when unread. Gmail remains responsible for category classification.

## 2026-08-15 — Display calendar dates in Pacific time

**Status:** Accepted

**Context:** Calendar day boundaries and displayed event times need one explicit application timezone rather than depending on the deployment server or browser location.

**Decision:** Use the IANA timezone `America/Los_Angeles` for Calendar API ranges, day grouping, and displayed event times.

**Consequences:** Bradley OS follows Pacific time and automatically switches between PST and PDT. Events may appear on a different day than in clients configured for another timezone, by design.

## 2026-08-15 — Adopt KISS as the primary design principle

**Status:** Accepted

**Context:** As the app grows past v0, there's a real risk of accumulating speculative abstractions, configurability, or defensiveness built for many users or many contributors — none of which this single-user app needs.

**Decision:** Recorded a "Design principle: KISS" section at the top of `AGENTS.md`: the simple, direct, boring solution wins over the clever one unless there's a concrete, stated reason it actually breaks. Applies to code and to review findings alike — e.g. a double Google-token-refresh-per-page-load bug was deliberately left as-is (documented as an accepted tradeoff) rather than fixed with a more architecturally "correct" split auth-config file, since the fix would add a permanent abstraction to prevent a narrow, low-stakes race in an app with one user.

**Consequences:** Future technical decisions should default to the smaller fix; reaching for a bigger one requires naming the concrete problem the simple version has, not just citing best practice or future-proofing.

## 2026-08-15 — Board home screen: react-grid-layout, persisted to a new `layouts` table

**Status:** Accepted

**Context:** The home screen needed to become a drag-to-rearrange, resizable board of Calendar/Inbox/Notes panels (the "Today dashboard" already scoped for v1), each with a compact summary and a "view all" link to the existing full page.

**Decision:** Use `react-grid-layout`, pinned to the mature 1.x line rather than the in-progress v2 rewrite (verified its `GridItem.js` already passes `nodeRef` to `react-draggable`, so it's React 19-safe). Persist panel position/size to a new `layouts` table — a single row holding one JSON blob, the same shape as `notes.bodyJson`/`diagrams.sceneJson` — rather than `localStorage`, since this is a daily-driver app plausibly opened from more than one device. Expand ("view all") navigates to the existing `/inbox`/`/calendar`/`/notes` pages rather than an overlay/modal, reusing what already works.

**Consequences:** Layout survives across devices/sessions at the cost of one small table and a debounced server action. The client-only board (loaded via a client-component wrapper around `next/dynamic(..., { ssr: false })`, since `next/dynamic` disallows `ssr: false` directly inside a Server Component) can't import anything that pulls in `googleapis`/`server-only` — this required splitting `lib/calendar/google.ts`'s pure date-formatting helpers into a new client-safe `lib/calendar/format.ts`, a pattern to reuse if other server-only modules need a client-facing subset in the future.

## 2026-08-15 — New features are board-first by default

**Status:** Accepted

**Context:** The home board is now Bradley OS's primary daily interface. Shipping full-page features without a board representation makes them harder to discover and leaves the daily overview incomplete.

**Decision:** Every new user-facing feature includes a compact home-board component unless the feature request explicitly excludes one. Board panels reuse `PanelShell`, summarize rather than duplicate the full feature, and navigate to the full page for deeper interaction.

**Consequences:** Feature scope now normally includes both a full surface and a compact serializable board summary. Existing persisted layouts must gain new panels without resetting the user's saved positions.

## 2026-08-15 — Todos is board-only with optimistic persistence

**Status:** Accepted; supersedes the separate-page expectation for Todos in "New features are board-first by default."

**Context:** Todos only needs add, check/reopen, and delete. A separate page duplicated a workflow that fits comfortably in its resizable board panel. Waiting for each Turso write plus a full home-page revalidation also made simple checklist actions feel slow because the board refetched Gmail and Google Calendar.

**Decision:** Keep the complete Todos workflow in its board panel with no `/todos` page. Apply changes immediately to local panel state, persist them asynchronously through server actions, and roll back with an error state on failure. Do not revalidate the whole board after todo writes.

**Consequences:** Todo interaction feels immediate while retaining durable Turso storage and failure visibility. A fresh page load remains the source-of-truth reconciliation. Other features still receive board panels by default, but only receive separate pages when their interaction depth requires one.

## 2026-08-15 — Use FullCalendar's Luxon adapter for Pacific time

**Status:** Accepted

**Context:** Passing `America/Los_Angeles` to FullCalendar without a named-timezone adapter allowed event display to follow the browser's Eastern timezone instead of the application's configured Pacific timezone.

**Decision:** Use `@fullcalendar/luxon3` with Luxon in every FullCalendar instance and retain `America/Los_Angeles` as the single Calendar timezone.

**Consequences:** The home-board and full-page week grids render consistent Pacific wall times regardless of the browser or deployment server timezone, including automatic PST/PDT transitions.

## 2026-08-15 — Colocate presentation in CSS Modules

**Status:** Accepted

**Context:** Long Tailwind utility strings embedded presentation details throughout JSX and made component structure harder to scan.

**Decision:** Use semantic classes from colocated CSS Modules for page and component presentation. Keep `app/globals.css` for design tokens, resets, shared primitives, and selectors required by third-party integrations.

**Consequences:** JSX emphasizes structure and behavior, while visual changes live in dedicated stylesheets. Shared board and FullCalendar selectors may remain global where their libraries require stable class names.

## 2026-08-15 — Keep one embedded diagram per note initially

**Status:** Accepted

**Context:** The schema permits multiple diagrams per note, but fully positioning arbitrary diagram blocks inside Tiptap would require a custom node extension, selection behavior, and more complex lifecycle management before the core drawing workflow has been validated.

**Decision:** Start with one note-owned Excalidraw canvas embedded directly after the note body. Persist its scene in the existing `diagrams` table and save edits with a short debounce.

**Consequences:** Notes gain a durable inline drawing surface with minimal editor complexity. Multiple diagrams and arbitrary placement within prose remain possible later if actual use demonstrates that need.
