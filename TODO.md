# TODO

Current and near-term work. Mutable — edit freely, unlike the journal or decisions log.

See `docs/designs/2026-08-15-v1-design-spec.html` for the full design spec this list is derived from.

## Before v0 starts
- [x] Register a Google Cloud project; create an OAuth client with the Calendar scope
- [x] Generate a Gmail App Password (myaccount.google.com/apppasswords, requires 2FA)
- [x] Provision a Turso database and auth token
- [x] Scaffold the Next.js app; fill in `AGENTS.md`'s Stack/Commands sections from the design spec

## v0 — first end-to-end slice
- [ ] Auth — sign in with Google, single-email allowlist
- [ ] Inbox digest — IMAP fetch, unread/24h list, no styling polish
- [ ] Calendar — read Google Calendar, list view only, no drag yet
- [ ] Notes — flat list + Tiptap editor, no diagrams yet
- [ ] Todos — flat checklist

## v1 — design spec scope
- [ ] Today dashboard — unify digest, calendar, notes, todos into one home screen
- [ ] Calendar — drag-to-create / drag-to-resize time-blocking (FullCalendar interaction plugin)
- [ ] Diagrams — Excalidraw, embeddable inline in notes
- [ ] Full-text search across notes
- [ ] Visual design system applied throughout (palette, type, motion, empty states)

## v1.1 — deferred
- [ ] Note ↔ calendar-event linking
- [ ] Multi-account email
- [ ] Calendar OAuth sensitive-scope verification (removes weekly re-consent)
