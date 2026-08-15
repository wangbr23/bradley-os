# bradley-os

A single-user web app that replaces three browser tabs — mail, calendar, notes — with one daily-driver: what's unread, what's next, what you were thinking.

Full design spec: [`docs/designs/2026-08-15-v1-design-spec.html`](docs/designs/2026-08-15-v1-design-spec.html).
Stack, commands, and architecture: [`AGENTS.md`](AGENTS.md).

## Setup

Requires Node 20+ and npm.

```bash
npm install
```

Create a `.env` file with:

```
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GMAIL_APP_PASSWORD=
TURSO_DATABASE_URL=
TURSO_AUTH_TOKEN=
```

- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — OAuth client (Web application type) from Google Cloud Console, Calendar scope, redirect URI `http://localhost:3000/api/auth/callback/google`.
- `GMAIL_APP_PASSWORD` — from `myaccount.google.com/apppasswords` (requires 2FA). Gmail is read over IMAP, not the Gmail API — see the design spec's Risks section for why.
- `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` — from `turso db show <name> --url` and `turso db tokens create <name>`.

Push the schema to the database:

```bash
npm run db:push
```

## Running it

```bash
npm run dev
```

Opens at `http://localhost:3000`.

## Testing changes

There's no automated test suite yet (tracked in `TODO.md`). Until there is, verify changes with:

```bash
npm run build   # production build + type-check
npm run lint    # eslint
npm run db:studio   # browse the Turso database in a local UI
```

For anything touching a UI surface, also run `npm run dev` and click through the change in the browser — type-checking and linting confirm the code compiles, not that the feature works.

## Project state

Check [`TODO.md`](TODO.md) for what's done and what's next, and [`docs/journal.md`](docs/journal.md) for a session-by-session log of what changed and why.
