# TODO

Current and near-term work. Mutable — edit freely, unlike the journal or decisions log.

See `docs/designs/2026-08-15-v1-design-spec.html` for the full design spec this list is derived from.

## Before v0 starts
- [x] Register a Google Cloud project; create an OAuth client with the Calendar scope
- [x] Generate a Gmail App Password (myaccount.google.com/apppasswords, requires 2FA)
- [x] Provision a Turso database and auth token
- [x] Scaffold the Next.js app; fill in `AGENTS.md`'s Stack/Commands sections from the design spec

## v0 — first end-to-end slice
- [x] Auth — sign in with Google, single-email allowlist
- [x] Inbox digest — IMAP fetch, Primary unread/24h list, no styling polish
- [x] Calendar — read Google Calendar, list view only, no drag yet
- [x] Notes — flat list + Tiptap editor, no diagrams yet
- [x] Todos — board-only flat checklist

## v1 — design spec scope
- [x] Today dashboard — Calendar/Inbox/Notes/Todos as a drag-to-rearrange, resizable board on the home screen with persisted layout — see `docs/designs/2026-08-15-board-home-screen.md`.
- [x] Calendar — Pacific-time FullCalendar week grid on both the home board and full Calendar page
- [x] Dashboard navigation performance — immediate shell, independent Inbox/Calendar loading, 60-second stale-while-revalidate caches, and manual refresh
- [x] Calendar interactions — drag-to-create / drag-to-move / drag-to-resize with optimistic Google Calendar persistence
- [x] Diagrams — one embedded Excalidraw canvas per note with debounced persistence
- [ ] Full-text search across notes
- [x] Notes — flat folders with filtering, create/rename/delete, note moving, and dashboard labels
- [x] Notes — debounced autosave for titles and Tiptap content
- [x] Visual design system applied throughout (palette, type, motion, empty states)

## v1.1 — deferred
- [ ] Note ↔ calendar-event linking
- [ ] Multi-account email
- [ ] Calendar OAuth sensitive-scope verification (removes weekly re-consent)

## Latency improvements
- [x] `T1` Stop note autosave from revalidating and rerendering the open note route — agent, complexity: simple
- [x] `T2` Reduce note-opening latency by parallelizing independent detail reads and loading diagram data only when Diagram mode opens — agent, complexity: complex
- [x] `T3` Remove redundant `router.refresh()` calls after note and folder Server Actions — agent, complexity: simple, depends-on: T2
- [x] `T4` Defer FullCalendar loading so the home Notes panel becomes interactive without waiting for calendar JavaScript — agent, complexity: simple (verified by lint/typecheck; full build blocked in this checkout by missing Turso env, same failure on clean tree)
- [x] `T5` Measure post-change note route timings and query behavior, then decide whether note indexes or list pagination are warranted — manual, depends-on: T1, T2, T3, T4 (observed latency much better; no further work warranted)
