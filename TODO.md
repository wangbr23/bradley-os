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
- [ ] Todos — board-only flat checklist (implemented; browser verification pending)

## v1 — design spec scope
- [x] Today dashboard — Calendar/Inbox/Notes/Todos as a drag-to-rearrange, resizable board on the home screen with persisted layout — see `docs/designs/2026-08-15-board-home-screen.md`.
- [x] Calendar — Pacific-time FullCalendar week grid on both the home board and full Calendar page
- [ ] Calendar interactions — drag-to-create / drag-to-move / drag-to-resize with optimistic Google Calendar persistence (implemented; browser verification pending)
- [ ] Diagrams — one embedded Excalidraw canvas per note with debounced persistence (implemented; browser verification pending)
- [ ] Full-text search across notes
- [ ] Visual design system applied throughout (palette, type, motion, empty states)

## v1.1 — deferred
- [ ] Note ↔ calendar-event linking
- [ ] Multi-account email
- [ ] Calendar OAuth sensitive-scope verification (removes weekly re-consent)
