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
