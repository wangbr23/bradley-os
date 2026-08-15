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
