# Plaid finance integration research

**Date:** 2026-09-14  
**Status:** Research only; no product scope or implementation decision has been made.

## Summary

Plaid is a practical fit for adding personal-finance widgets to Bradley OS. The API and React integration are straightforward, but a reliable Transactions integration is more than a single fetch: it needs durable access-token storage, incremental synchronization, signed webhooks, transaction reconciliation, reconnect and disconnect flows, and careful handling of cached financial data.

For the first version, use only Plaid Transactions. It covers transaction history for checking, savings, and credit-card accounts and returns cached account balances. Add Liabilities only if widgets need credit-card payment due dates, minimum payments, statement balances, or APRs.

Do not enable Auth, Identity, Balance, Transfer, or Statements initially:

- Auth exposes account and routing numbers and is unnecessary for personal finance views.
- Identity exposes account-owner PII and is unnecessary.
- Transfer adds money-movement capability and a much larger risk surface.
- Balance is a paid, per-request real-time balance check. Transactions already provides balances refreshed roughly one to four times per day, which should be enough for dashboard widgets.
- Plaid Statements means actual bank-branded PDF statements, not transaction history. It supports only depository accounts, has much narrower institution coverage, adds flexible per-statement charges, and creates more sensitive files to protect.

## Product fit

| Need | Plaid product | Billing model | Recommendation |
| --- | --- | --- | --- |
| Checking, savings, and credit-card transactions; categorized spending; cached balances | Transactions | Monthly subscription per Item | Start here |
| Card due date, minimum payment, statement balance, APR, overdue status | Liabilities | Separate monthly subscription per Item | Add only when a widget needs it |
| Current balance fetched live from the institution | Balance | Per successful request | Skip initially |
| Exact bank-branded PDF statements | Statements | Flexible fee based on statements extracted | Skip unless literal PDFs are required |
| Routing/account numbers | Auth | One-time per Item | Do not enable |
| Account-owner identity data | Identity | One-time per Item | Do not enable |
| Move money | Transfer | Multiple usage fees | Do not enable |

An **Item** is one login at one financial institution, not one individual account. One bank login that contains checking, savings, and a credit card is normally one Item. Logins at separate institutions are separate Items.

Transactions supports up to 730 days of initial history and then retains new transactions while the Item remains connected. The history window must be chosen before initializing Transactions; increasing it later can require deleting and relinking the Item. Plaid normally checks for new transactions one to four times per day.

Plaid reports typical fill rates of 100% for amount/date/description, 97% for merchant name where a merchant exists, and 95% for personal-finance category. Institution and field coverage still varies, so each intended bank/card issuer should be checked in Plaid's Coverage Explorer or Dashboard before relying on a particular widget.

## Integration flow

1. A protected server action calls `/link/token/create` for the signed-in owner with `transactions` and the selected history window.
2. The browser opens Plaid Link through the official `react-plaid-link` package. Bank credentials are entered into Plaid Link or the bank's OAuth page, not into Bradley OS.
3. Link returns a temporary `public_token`; a protected server action exchanges it for a long-lived `access_token` and `item_id`.
4. Bradley OS encrypts the access token and stores it server-side. It never sends the access token or Plaid secret to the browser.
5. Bradley OS calls `/transactions/sync`, applies added/modified/removed transactions, and saves the returned cursor atomically.
6. A public HTTPS webhook verifies Plaid's signature and marks the matching Item as needing sync. The next page load or a small scheduled job performs the sync. This keeps the webhook fast without introducing a queue for one user.
7. `ITEM_LOGIN_REQUIRED`, expiring consent, and similar states launch Link in update mode instead of creating a duplicate Item.
8. Disconnect first calls `/item/remove`; only after it succeeds does the app delete the access token and local financial data. This both revokes the token and stops subscription billing.

The public webhook is the unusual route in this app. The current `proxy.ts` protects every non-Auth route, so a future Plaid webhook route must be narrowly excluded from Auth.js and authenticate Plaid itself using the `Plaid-Verification` JWT. The signature check must use the untouched raw request body, require ES256, reject signatures older than five minutes, and compare the body hash in constant time. Delivery can be duplicated or out of order, so processing must be idempotent.

## Suggested data shape

The minimum durable model is three tables:

- `plaid_items`: Item ID, institution metadata, encrypted access token, sync cursor, connection/error state, and last successful update.
- `financial_accounts`: Plaid account ID, Item ID, display name, mask, type/subtype, currency, and latest cached balances.
- `financial_transactions`: Plaid transaction ID, account ID, amount, dates, merchant/description, category, pending state, and updated timestamp.

Liability snapshots can be added later if Liabilities is enabled. Do not store bank credentials, full account/routing numbers, Link events containing credential-related metadata, or PDF statements in the initial version.

## Complexity estimate

The existing Next.js, React, Auth.js, Drizzle, and board-panel patterns are a good fit. The difficult parts are synchronization correctness and security, not the Link button.

| Scope | Estimated engineering effort |
| --- | --- |
| Sandbox Link demo, token exchange, and account list | 2-3 days |
| Secure Transactions storage and initial/incremental sync | 2-4 days |
| Verified webhook, reconnect, duplicate prevention, and disconnect | 2-3 days |
| Finance page, first board panel, loading/error states | 2-4 days |
| Targeted tests, deployment verification, and security review | 2-3 days |
| **Production-ready Transactions first version** | **Approximately 10-16 engineering days total** |
| Add Liabilities and card-payment widgets | 1-2 additional days |
| Add literal statement listing/download | 2-4 additional days, plus more security work |

These are implementation estimates, not Plaid approval times. The estimate assumes Bradley OS has or will have a stable HTTPS deployment. If it remains local-only, a secure public webhook receiver and Production OAuth setup add deployment work.

There is no automated test suite today. A financial sync should not ship with browser testing alone. At minimum, add focused tests for access-token encryption, owner authorization, signature verification, added/modified/removed transaction reconciliation, cursor rollback/retry, duplicate webhook delivery, and disconnect failure handling.

## Current security baseline

### Existing strengths

- Google sign-in is restricted to the configured owner email in `auth.ts`.
- `proxy.ts` protects all application routes except Auth.js and sign-in routes.
- Auth.js uses an encrypted JWT in an HttpOnly cookie by default because no database adapter is configured.
- Existing Notes, Todos, and layout mutations call `requireOwner()`; Calendar writes separately require an authenticated Google session.
- Database and provider credentials are server environment variables, and `.env` files are gitignored.
- No current code uses `dangerouslySetInnerHTML`, `localStorage`, or `sessionStorage` for application data.
- Turso states that all Cloud databases are encrypted at rest at the volume level. BYOK database encryption is available on paid Turso plans.

### Gaps to close before live financial data

1. `auth.ts` copies the Google access token into the session object. Auth.js documents that the session callback's return value is exposed through the client session endpoint. Refactor Calendar access so provider tokens remain server-only; never add a Plaid token to the Auth.js session.
2. `requireOwner()` currently checks only that some authenticated user exists. The outer Auth.js proxy enforces the owner email, but finance data access should directly compare the session email with `OWNER_EMAIL` as defense in depth.
3. `next.config.ts` has no CSP or other explicit security headers. Add a nonce-based, Plaid-compatible CSP plus HSTS, `frame-ancestors`, `X-Content-Type-Options`, and a conservative Referrer Policy. Plaid Link requires explicit `cdn.plaid.com` frame/script access and the appropriate Plaid API host in `connect-src`.
4. Auth.js JWT sessions default to 30 days and cannot be revoked immediately if a cookie was copied. Choose a shorter session lifetime for this app, and protect the owner Google account with a passkey/security key or strong two-step verification. A logged-in, unattended browser remains authorized regardless of the email allowlist.
5. Deployment controls are not documented. Before Production, verify HTTPS-only access, production/preview secret separation, deployment-account MFA, no public production database tooling, and no production secrets in preview builds.
6. Financial responses need explicit no-store/private caching behavior. Do not put balances, transactions, access tokens, or Link tokens in browser storage or the existing browser-session panel cache.

## Recommended security model

### Access control

- Keep one Google identity and compare its normalized email on every finance action/read, not only at the route proxy.
- Require MFA/passkey protection on Google, Plaid Dashboard, Turso, deployment, source-hosting, and email accounts where available.
- Consider a 12-24 hour Auth.js session instead of the 30-day default. Device lock and full-disk encryption still matter because an open session is an authorized session.
- Do not expose a finance API that accepts an arbitrary user ID. Use a fixed server-side owner identity.

### Secrets and tokens

- Keep `PLAID_SECRET`, the Turso token, `AUTH_SECRET`, and a new finance-encryption key in the deployment secret store, with separate Sandbox and Production values.
- Encrypt every Plaid access token with authenticated encryption such as AES-256-GCM before writing it to Turso. Store nonce, ciphertext, authentication tag, and a small key-version marker; keep the encryption key outside Turso.
- Rotate a Plaid access token with `/item/access_token/invalidate` if exposure is suspected. Rotate the Plaid secret from its Dashboard and remove the old secret after the deployment is confirmed.
- Never log access/public/link tokens, Plaid secrets, account/routing numbers, transaction descriptions, merchant names, amounts, or full Plaid responses. Log only the minimum identifiers and Plaid request IDs needed for troubleshooting.

Turso's default volume encryption protects lost disks and snapshots, but a valid database token can still read plaintext query results. Encrypting Plaid access tokens separately materially limits that credential's impact. Encrypting every transaction row would prevent normal SQL aggregation and is not necessary for the stated threat of another app user gaining access. If database-provider compromise becomes part of the threat model, consider a separate finance database with Turso BYOK rather than inventing per-column searchable encryption.

### Data minimization and browser safety

- Request only Transactions and only the accounts/history needed for the chosen widgets.
- Persist only fields used by the product; omit locations and raw descriptions unless a widget requires them.
- Return only aggregate or recent data needed by each board panel. Load the full transaction list only on a protected finance page.
- Mark finance pages and API responses `no-store`; do not use the current panel browser-session cache for finance data.
- Do not add third-party analytics, session replay, or client-side error reporting to finance surfaces unless payload redaction is verified.
- Purge local data when an account is disconnected, after Plaid confirms `/item/remove`.

### Webhook and sync safety

- Expose exactly one unauthenticated webhook route and verify Plaid's signed JWT/body hash before trusting `item_id` or changing state.
- Apply strict body-size and method limits, return no financial data, and make duplicate/out-of-order delivery harmless.
- Save transaction changes and the next cursor in one database transaction. If pagination fails or Plaid reports mutation during pagination, restart from the original cursor.
- Show data freshness and connection errors in the UI. Plaid data is normally updated one to four times daily, not in real time.
- Prevent duplicate Items before exchanging a public token. Duplicate Items can create duplicate data and duplicate subscription charges.
- On disconnect failure, retain the encrypted access token and show an error so `/item/remove` can be retried; deleting the only token first can leave an unremovable billed Item.

## Cost research

### Free environments

- Sandbox usage is free and should be used for nearly all development and failure testing.
- Plaid's current billing documentation says teams created on or after 2026-04-15 can use a free Trial plan with up to 10 lifetime Production Items. Transactions, Transactions Refresh, Liabilities, Balance, and Statements are listed as available on Trial.
- Removing an Item does not restore a Trial Item slot. Avoid experimenting with real accounts until Sandbox behavior and durable token storage are verified.

There is a conflict in Plaid's current public material: the main pricing page still describes a free "Limited Production" service with 200 live calls per available product, while the more detailed billing docs describe the newer 10-Item Trial. Confirm the account's actual limits in the Plaid Dashboard or with Plaid support before relying on either limit.

For a single user with fewer than 10 institution logins, the documented Trial could make Plaid's API cost **$0**. This needs Dashboard confirmation, especially because Trial slots are lifetime slots.

### Paid usage

Pay-as-you-go has no minimum spend or commitment. Plaid does not publish current unit prices in its public documentation. Exact Pay-as-you-go and Growth prices are shown on the last page of the Production access request before submission.

The cost formula for the recommended design is:

```text
monthly Plaid cost =
  Transactions rate x active Items with Transactions
  + Liabilities rate x active Items with Liabilities
  + successful real-time Balance calls x Balance rate
  + successful Transactions Refresh calls x Refresh rate
  + any Statements extraction charges
```

`/accounts/get`, institution, Item-management, and similar non-product endpoints are generally free. A subscription Item is billed for each UTC calendar month in which its access token remains valid, even if it is broken or unused, and partial months are not prorated. `/item/remove` ends future subscription billing.

For the recommended Transactions-only design, cost scales with the number of institution logins, not transaction count or page views. A one-user bill should therefore be small relative to a normal multi-user app, but a responsible dollar estimate is not possible until the Dashboard reveals the current per-Item rate. Old third-party price lists should not be used as a budget because Plaid explicitly withholds current prices from public docs.

### Other costs

- No additional data service is required for a small transaction history; Turso can hold it comfortably.
- Turso BYOK is limited to Pro/Enterprise plans, so using it may add database cost. It is optional for the initial threat model.
- Hosting must provide a stable HTTPS app origin and webhook endpoint. If the app is not already deployed, hosting and operational work are separate from Plaid fees.
- The largest initial cost is engineering time, not per-Item API usage.

## Production access and operational constraints

- Plaid Link is mandatory in Production.
- OAuth support is required for many large US banks. Production redirect URIs must use HTTPS, except localhost in Sandbox.
- Plaid requires application and company profiles for certain institutions. Paid plans may also require institution registration, a Plaid agreement, and a security questionnaire. Trial plans are exempt from some registration steps until upgrade.
- Some institutions grant access within hours after requirements are complete; some can take up to five business days.
- Connections can require periodic consent renewal or repair. Update mode and related webhooks are part of the real integration, not optional polish.
- Literal Statements currently covers only depository accounts and roughly 40% of US depository accounts; it should always have a fallback.

## Recommended rollout

1. Confirm intended institutions and whether "statements" means transaction history or actual PDFs.
2. Create a Plaid account, inspect the Trial/Pay-as-you-go terms shown in the Dashboard, and verify institution/product coverage.
3. Build and test a Transactions-only flow entirely in Sandbox, including bad credentials, delayed history, pagination, modified/removed transactions, duplicate webhooks, update mode, and disconnect.
4. Complete the security hardening above and document the production deployment boundary.
5. Connect one real institution on Trial and run it for several days before adding other Items.
6. Build the first board panel from locally synchronized Transactions data.
7. Add Liabilities only after choosing a widget that requires its fields.

## Open questions

- Does "bank statements" mean a transaction feed, or downloadable official PDF statements?
- Which banks and card issuers must work? Product coverage differs by institution.
- How much initial history is useful: 90 days, one year, or the 730-day maximum?
- Where will the app be hosted in Production, and is it currently reachable only locally?
- Is daily cached balance sufficient, or is a paid real-time Balance button required?
- Are payment due dates/APRs part of the first widgets, requiring Liabilities?
- Is the main security goal blocking unauthenticated internet users, or must the design also protect against someone using an already-unlocked device/browser?

## Primary sources

- [Plaid Quickstart](https://plaid.com/docs/quickstart/)
- [Plaid Link overview](https://plaid.com/docs/link/)
- [Plaid Link Web SDK and CSP directives](https://plaid.com/docs/link/web/)
- [Plaid OAuth guide and Production requirements](https://plaid.com/docs/link/oauth/)
- [Plaid Transactions overview](https://plaid.com/docs/transactions/)
- [Add Transactions to an app](https://plaid.com/docs/transactions/add-to-app/)
- [Transactions webhooks](https://plaid.com/docs/transactions/webhooks/)
- [Plaid webhook verification](https://plaid.com/docs/api/webhooks/webhook-verification/)
- [Plaid Items and access-token lifecycle](https://plaid.com/docs/api/items/)
- [Plaid Link update mode](https://plaid.com/docs/link/update-mode/)
- [Preventing duplicate Items](https://plaid.com/docs/link/duplicate-items/)
- [Plaid Liabilities](https://plaid.com/docs/liabilities/)
- [Plaid Balance](https://plaid.com/docs/balance/)
- [Plaid Statements](https://plaid.com/docs/statements/)
- [Plaid pricing and billing](https://plaid.com/docs/account/billing/)
- [Plaid public pricing page](https://plaid.com/pricing/)
- [Plaid Dashboard account security](https://plaid.com/docs/account/security/)
- [Plaid data handling](https://plaid.com/how-we-handle-data/)
- [Auth.js session strategies](https://authjs.dev/concepts/session-strategies)
- [Turso BYOK and default at-rest encryption](https://docs.turso.tech/cloud/encryption)
