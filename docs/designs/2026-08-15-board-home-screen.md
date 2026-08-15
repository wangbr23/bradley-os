# Board home screen

Status: Implemented and browser-verified; Todos extension added
Date: 2026-08-15
Supersedes: nothing. Implements the "Today dashboard" item already scoped in `TODO.md` (v1) and the original design spec (`docs/designs/2026-08-15-v1-design-spec.html`).

## Problem

`app/page.tsx` is currently a static, centered stack of three `.ink-action` links out to `/inbox`, `/calendar`, and `/notes`. The user wants it replaced with a board: Calendar, Notes, and Inbox as panels the user can drag to reposition and resize (e.g. Calendar top-left, Notes right, Inbox in the middle), each panel showing a compact summary, with a "view all" control on each panel that navigates to the corresponding full page.

## Grounding: what actually exists right now

Read from `docs/journal.md`, `docs/decisions.md`, and the current code, not from the original spec's assumptions — several details were decided or changed during v0 build-out:

- **Auth** (`auth.ts`): Auth.js JWT sessions, Google provider, single-email allowlist (`OWNER_EMAIL`). Requests offline Calendar access in the same consent flow; refreshes the Google access token through Google's token endpoint. Node pinned to 24 LTS (a local TLS/CA issue, not a product decision).
- **Inbox** (`lib/mail/inbox.ts`, `app/inbox/page.tsx`): ImapFlow over IMAP with a Google App Password, **not** the Gmail REST API (avoids CASA/restricted-scope review, per the original spec). Opens INBOX read-only. **Scoped to Gmail's Primary category only** (`category:primary` + `is:unread` + `newer_than:1d`, then an exact 24h cutoff) — this narrowed from all categories after the unfiltered version proved noisy (`docs/decisions.md`, "Limit the inbox digest to Gmail Primary"). Capped at 50 messages. Never sets `Seen`, never stores messages locally.
- **Calendar** (`lib/calendar/google.ts`, `app/calendar/page.tsx`): Google Calendar API, thin read proxy, no local event storage. Fetches a 7-day window, expands recurring events. **Displays in `America/Los_Angeles`**, explicitly, regardless of server/browser timezone (`docs/decisions.md`, "Display calendar dates in Pacific time"). Day-grouping helpers (`getDayKey`, `formatDay`, `formatTime`) are currently private to the page component.
- **Notes** (`lib/db/schema.ts`, `app/notes/page.tsx`, `app/notes/[id]/page.tsx`, `app/notes/actions.ts`, `components/notes/note-editor.tsx`): Turso/Drizzle schema applied for real (`notes`, `diagrams`, `todos` tables now live, not just designed). Tiptap editor with bold/italic/headings/lists, explicit save status, delete confirmation. Per the journal, the create/save/reload/delete flow is implemented but **browser verification is still pending** — treat Notes as functionally there but not yet fully confirmed.
- **Todos**: persistent flat checklist implemented directly in its board panel; no separate page.
- **Visual system** (`app/globals.css`): white background with a CSS-only dot-grid (`radial-gradient`, 22px pitch), near-black dark mode, one amber `--accent`, hairline `--border` rules, zero shadows/radii anywhere. `.ledger-rule` (hairline top border), `.ink-action` (underline button, no fill, thickens into a highlighter swipe on hover/focus via `.ink-action::after`). Two type roles: `font-mono` (Geist Mono — headers, labels, structure) and `font-serif` (Newsreader — body copy, including `.tiptap-note` for the notes editor). `•` / `○` / `–` glyphs are functional markers for task / event-or-status / note, used consistently across `/inbox`, `/calendar`, and the home page already.
- **Home page** (`app/page.tsx`): server component, calls `auth()`, renders the ledger-rule/eyebrow/title header pattern, then three stacked `.ink-action` links plus sign-out. This is what's being replaced.

## Goals

- Calendar, Notes, Inbox as draggable, resizable panels on the home screen.
- Each panel shows a compact summary (not the full page) with a "view all" control.
- Layout (position/size) persists across sessions and devices.
- Zero visual regression from the established bullet-journal system — no cards, shadows, radii, icon badges, or colored pills creeping in via a library's default styles.

## Non-goals (v1 of this feature)

- A separate Todos page — the complete add/check/delete workflow fits in the panel.
- Multi-column responsive reflow beyond "it still works on a laptop screen" — no dedicated mobile board layout in this pass.
- Real-time/multi-device *live* sync of layout changes — persistence just needs to survive a reload, not broadcast between simultaneously open tabs.

## Design

### Library: `react-grid-layout`, pinned to the 1.x line

Compared against `dnd-kit` (drag only, resize would be hand-rolled), `gridstack.js` (capable, but a vanilla-DOM library with a less battle-tested React wrapper and more "dashboard-y" default chrome), and `react-resizable-panels` (resize-only, fixed pane tree — doesn't support freeform repositioning, so it doesn't cover the actual ask). `react-grid-layout` is purpose-built for exactly this "board of x/y/w/h widgets" shape, and its default CSS supplies no background/shadow/radius — only a resize-handle icon and a drag-placeholder ghost, both fully restyleable. Pin to the mature 1.x line, not the very recent v2 TypeScript rewrite still in progress.

**Verify before adopting**: the pinned version's `react-draggable` dependency must include `nodeRef` support — React 19 removed `ReactDOM.findDOMNode`, which broke older `react-draggable`.

The grid shell is a `"use client"` component, loaded via `next/dynamic(..., { ssr: false })`, since RGL measures container width on mount and can't produce a meaningful server render. `app/page.tsx` stays a server component; it fetches data and passes it down as props. The grid library itself never fetches anything.

### Persistence: new `layouts` table, one JSON row

```ts
export const layouts = sqliteTable("layouts", {
  id: text("id").primaryKey(), // constant, e.g. "home"
  layoutJson: text("layout_json", { mode: "json" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});
```

Same shape as the existing `notes.bodyJson` / `diagrams.sceneJson` convention — one table, one JSON blob, no new pattern. Chosen over `localStorage` because this is a daily-driver app behind Google sign-in, plausibly opened from more than one device (phone + laptop); a layout that silently resets per-device is a real recurring annoyance. Debounce writes to drag/resize-*stop* (RGL's `onLayoutChange` fires continuously; use `onDragStop`/`onResizeStop`), never per-frame.

### Expand interaction: plain navigation, no modal

Each panel's "view all" is a `.ink-action` `Link` to `/inbox`, `/calendar`, or `/notes`. All three already implement their own loading/error states and back-navigation. A modal/overlay would duplicate that for no stated benefit.

### Data fetching

`app/page.tsx` fetches three summaries via one `Promise.all` rather than per-panel `<Suspense>` boundaries — the RGL grid needs all three panels present as children at once, so streaming them in individually would mean passing already-resolved Server Component output through the client boundary as slots, real added structure for a benefit (partial streaming on a personal single-user page) that isn't concretely needed yet. `/inbox` and `/calendar` already block synchronously the same way. Simpler and consistent; revisit only if a slow IMAP round-trip in practice makes the home page noticeably slow.

- **Inbox**: `getInboxDigest()` from `lib/mail/inbox.ts`, sliced to the top 2-3. Already Primary-only/24h-scoped; no new filtering needed.
- **Calendar**: today's events only, in `America/Los_Angeles`. `getDayKey`/`formatDay`/`formatTime` need to move from `app/calendar/page.tsx` (currently private to that component) into `lib/calendar/google.ts` so the panel and the full page share one implementation instead of two copies of the same date logic.
- **Notes**: most-recently-edited 3-5, via a small new Drizzle query (`orderBy(desc(notes.updatedAt)).limit(5)`) — no new abstraction, just a query alongside the existing schema.

Each summary is passed as plain serializable props into presentational panel components rendered inside the client-only grid shell. No client-side data-fetching library — consistent with the rest of the app.

### Visual spec (extends `app/globals.css`, introduces no new pattern)

Revised after mocking the whitespace-only-separation version and finding it read as three disconnected text lists rather than actual components — the fix keeps every existing token/rule (dot-grid, hairline `--border`, single `--accent`, no shadows/radii/color-badges) but gives each panel a real frame and a piece of hero content, the way `docs/designs/2026-08-15-board-home-screen-mock.html` (v2) shows:

- **Panel as index card** — each panel is a full `1px solid var(--border)` box, sharp corners, `background: var(--background)` (opaque — this is what masks the page's own dot-grid inside the panel's bounds, so panels read as pages resting on the dotted desk rather than cut-outs of the same texture). This replaces the earlier "whitespace-only, shared-edge-rule-only" separation rule — a full hairline frame, not a shadow or fill color, is what makes a panel legible as a distinct component. Gutters between panels (where the dot-grid still shows through) snap to multiples of the existing 22px dot-grid pitch.
- **Watermark glyph** — the panel's own `•`/`○`/`–` glyph, oversized (~4rem), `var(--accent)` at ~8% opacity, positioned top-right, `pointer-events: none`. This is the ink/mono equivalent of an icon badge: an identity mark with zero added color or iconography.
- **Headline stat** — every panel leads with one big number/value in tabular-nums mono directly under the header: unread count for Inbox, next event time + title for Calendar, note count for Notes. This is the piece that makes a panel read as an instrument rather than a shrunk list — without it, three panels of small text rows don't visually differ from the plain link list they're replacing.
- **Calendar week-dot-strip** — seven small circles (Mon-Sun), filled `var(--accent)` for days with an event, hollow `var(--border)` outline for free days, today ringed. A literal, functional reuse of the page's own dot-grid motif as a tiny at-a-glance viz, instead of borrowing a sparkline.
- **Panel header / drag handle** — same eyebrow → title voice as `/inbox`/`/calendar`, compacted. Eyebrow becomes a live stat ("Last 24h", "Today, Aug 15", "Recently edited") instead of a static range. The entire header bar is the drag handle, `cursor: grab`, no icon — on drag its bottom rule thickens via the same `transition: height 150ms linear` already defined on `.ink-action::after`, the existing motion language retargeted rather than a new one.
- **Resize handle** — a small "⌐" corner-tick (two 1px segments, ~8-10px) bottom-right inside the card's own padding, `var(--muted)` → `var(--accent)` on hover, `cursor: nwse-resize`. Not RGL's default dot-cluster, which would visually merge into the page's own dot-grid.
- **Drag ghost** — 1px dashed `var(--border)` outline, no fill, no shadow, no radius.
- **Explicitly excluded**, all of it real chrome RGL or a naive integration would otherwise introduce: colored icon badges, category pills, drag-shadow elevation, rounded corners, avatar-style headers, tinted (non-`--background`) panel fills, notification-count bubbles.

### Compact panel content

All three panels share one skeleton: watermark glyph → eyebrow → glyph title (drag handle) → headline stat → (Calendar only: week-dot-strip) → 2-3 more rows → `.ink-action` footer.

- **Inbox** — stat: unread count. Rows: `•` + sender (truncated) + subject (truncated, one line) + right-aligned `font-mono text-[10px]` time. Footer: "View all →".
- **Calendar** — stat: next event's time + title. Week-dot-strip. Rows: `○` + time + title for the rest of today's events. Empty state reuses the existing italic-muted "Nothing scheduled" line. Footer: "View week →".
- **Notes** — stat: total note count. Rows: `–` + title (truncated), most-recently-edited first, relative time right-aligned. Footer: "View all" / "New note" (reuses the existing `createNote` server action).

### Component structure

- `app/page.tsx` — server component: `Promise.all`-fetches the three summaries, renders `<BoardClient>` with them as props.
- `components/board/panel-shell.tsx` — the shared chrome every panel uses: index-card border, watermark glyph, header/drag-handle, resize tick. Content-specific components render inside it rather than each repeating the same CSS.
- `components/board/board-client.tsx` — `"use client"`, dynamic-imported (`ssr:false`), owns the RGL grid, drag/resize state, debounced persistence to `layouts`.
- `components/board/inbox-panel.tsx`, `calendar-panel.tsx`, `notes-panel.tsx` — presentational, each wraps `panel-shell` with its own stat/rows/footer.
- `lib/db/schema.ts` — add the `layouts` table.
- `lib/calendar/google.ts` — export the day-key/format helpers currently trapped in `app/calendar/page.tsx`.

## Risks

- **React 19 / `react-draggable` compatibility** must be verified against the exact pinned RGL version before committing — this is a live compatibility seam, not a settled fact.
- **Home page now does live external I/O** (IMAP + Google Calendar) on every load, where it previously did none — same as `/inbox` and `/calendar` already do, but now on the first page loaded every session. Worth watching in practice; add per-panel streaming later only if it's actually slow.
- **RGL ships its own base stylesheet** (`react-grid-layout/css/styles.css`) — needs a quick check against Tailwind v4's reset for conflicts, then override to remove all default chrome.
- **Write amplification** on layout persistence if drag-stop debouncing isn't implemented correctly.

## Rollout

1. Add `layouts` table + migration.
2. Export calendar date helpers from `lib/calendar/google.ts`.
3. Build the three presentational panel components against the existing visual spec.
4. Add `react-grid-layout` (pinned 1.x), verify React 19 compatibility, build `BoardClient`.
5. Wire `app/page.tsx` to fetch + stream summaries and render the board.
6. Manual verification: drag, resize, reload (layout persists), each panel's "view all" lands on the correct existing page, no shadows/radii/badges in light or dark mode.
