# Journal

Append-only. One entry per work session. Newest at the bottom. Don't edit past entries — if something's wrong now, say so in a new entry.

## 2026-08-15 — project created

Initialized project scaffold (AGENTS.md, decisions log, TODO). Nothing built yet.

## 2026-08-15 — v0 authentication completed

Implemented Auth.js Google sign-in, protected application routes, and restricted access to `brwang48198@gmail.com`. Requested offline Google Calendar access and added access-token refresh handling so the calendar slice can reuse the authenticated session. Added sign-in/sign-out UI and generated the local Auth.js secret without exposing it.

Resolved local HTTPS failures by upgrading the development runtime from EOL Node.js 20 to Node.js 24 LTS and using Homebrew's current CA bundle for local Next.js commands when available. Google OAuth now completes successfully. Lint, TypeScript, and the webpack production build pass. Next: build the read-only Gmail IMAP inbox digest.
