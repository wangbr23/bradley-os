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
