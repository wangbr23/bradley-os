# bradley-os

A single-user web app that replaces mail, calendar, and notes with one daily-driver: what's unread, what's next, what you were thinking. Full spec: `docs/designs/2026-08-15-v1-design-spec.html`.

## Design principle: KISS

This is the most important principle in this file. The simple solution beats the clever one — always — unless there's a concrete, stated reason the simple version actually breaks. This is a single-user app; it does not need the abstractions, configurability, or defensiveness of software built for many users or many contributors.

- Don't add a layer, config option, or abstraction for a future need — add it when that need is real.
- Prefer the boring, obvious implementation over the elegant one, if the boring one is easier to read and change later.
- If you're about to introduce a new file, pattern, or dependency to solve a problem, first check whether the existing code can just be changed instead.
- When a review or a fix has more than one option, default to the smaller, more direct one. Reach for the more involved fix only when the simple one has a concrete, documented shortcoming — not "might not scale" or "isn't the textbook pattern."
- Unless explicitly excluded, every new user-facing feature includes a home-board panel. Reuse `PanelShell`; add a separate full page only when the feature needs more space or depth than its panel.

## Stack
- Language/runtime: TypeScript, Node.js 24 LTS (local app commands use Homebrew's CA bundle when available)
- Framework: Next.js (App Router), Tailwind CSS, @base-ui/react
- Data: Turso (libSQL/SQLite) via Drizzle ORM
- Auth: Auth.js (next-auth@beta), Google provider, single-email allowlist
- Calendar: Google Calendar API — FullCalendar (timegrid + interaction) on the frontend
- Email: Gmail via IMAP (imapflow) + Google App Password — not the Gmail REST API
- Notes: Tiptap; Diagrams: Excalidraw; Icons: @phosphor-icons/react; State: Zustand
- Package manager: npm

## Commands
- Install: `npm install`
- Dev/run: `npm run dev`
- Test: (none yet)
- Lint/typecheck: `npm run lint`
- Build: `npm run build`
- DB schema push: `npm run db:push`
- DB migrations: `npm run db:generate`
- DB browser: `npm run db:studio`

## Conventions
- Code style: default eslint-config-next; no additional formatter configured yet. Keep page/component presentation in colocated CSS Modules; reserve `app/globals.css` for tokens, resets, and shared semantic primitives rather than Tailwind utility strings in JSX.
- Testing approach: none set up yet.
- Commit message format: not yet decided (no git repo initialized yet).

## Architecture
Single Next.js app, no monorepo tooling. Route Handlers/Server Actions carry the backend — no separate API service. Calendar events are never stored locally; Google Calendar is the system of record. `lib/db/schema.ts` holds four local tables: `notes`, `diagrams` (optionally linked to a note), `todos`, and the persisted home-board `layouts`. See the design spec (`docs/designs/2026-08-15-v1-design-spec.html`) and board design (`docs/designs/2026-08-15-board-home-screen.md`) for the reasoning.

## Context files
Keep these current — they're what gives any session, or either CLI tool, continuity without re-deriving history from scratch.

- **AGENTS.md** (this file) — stack, commands, conventions, architecture. Update only when one of those actually changes; it should stay stable day to day.
- **CLAUDE.md** — pointer to this file only. Don't duplicate content into it.
- **docs/journal.md** — append-only session log. Never edit past entries; if something turns out wrong, say so in a new one.
- **docs/decisions.md** — append-only log of significant technical decisions (dependency choices, schema changes, rejected approaches), one entry per decision. Never edit past entries — a reversed decision gets a new entry that supersedes the old one.
- **docs/designs/** — design documents (specs, mockups, research write-ups). One file per document; save the working version here rather than leaving it only in chat or artifact history.
- **TODO.md** — current and near-term work. The only file in this list meant to be edited freely rather than appended-only.

**Before starting nontrivial work:** read this file, skim the last few journal entries, check TODO.md.
**After finishing a session:** append a journal entry (what changed, why, what's next), update TODO.md, and append a decision entry if a decision worth remembering was made.
