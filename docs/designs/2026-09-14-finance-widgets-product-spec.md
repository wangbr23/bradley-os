# Finance Widgets — Product Spec

**Last updated:** 2026-09-14

## Overview

Bradley OS is a single-user web app. This spec covers its first finance integration: two home-board widgets — **Bank Accounts** and **Credit Cards** — that show current balances and recent transactions, backed by secure connections the user establishes with their financial institutions.

The widgets are read-only views. Data updates automatically on the connection's own schedule; the user is asked to reauthorize a connection only when the bank or the connection service reports it is broken or about to expire. Connections persist independently of the user's Bradley OS sign-in: logging out of the app, or an expired app session, never requires re-entering bank credentials.

## Core Concepts

- **Bank connection** — A connection between a financial institution and Bradley OS, created through the institution's own sign-in and authorization screens. One connection can cover multiple accounts. States: **Healthy** (data updating normally), **Needs attention** (broken, expiring, or otherwise in need of reauthorization; data may be outdated), **Disconnected** (the user removed it).
- **Bank account** — A checking, savings, or other deposit account within a connection. Identified by institution name and masked number (e.g. "Chase ••4321). Has a current balance and a list of recent transactions.
- **Credit card** — A card account within a connection. Identified by issuer and masked number. Has a current balance (the amount owed) and a list of recent transactions.
- **Transaction** — One money movement record with a description or merchant name, a date, and an amount. May be marked as pending.
- **Last updated** — The time of the widget's most recent successful data refresh, always shown so the user can judge freshness.

## Functional Requirements

### FR-1: Bank Accounts widget

- FR-1.1 The user can see a Bank Accounts widget on the home board showing the combined balance of all connected bank accounts as a headline figure.
- FR-1.2 In the same widget, each connected bank account is listed with its own balance. Accounts are not separated into tabs.
- FR-1.3 The widget shows the five most recent transactions across the connected bank accounts, each with description, date, and amount.
- FR-1.4 Pending transactions appear in the list and are labeled as pending.
- FR-1.5 When no bank accounts are connected, the widget shows an empty state with a "Connect bank" action.
- FR-1.6 The widget shows the Last updated time (see FR-4).

### FR-2: Credit Cards widget

- FR-2.1 The user can see a Credit Cards widget on the home board with one tab per connected credit card (up to five cards).
- FR-2.2 Each tab shows the card's current balance (amount owed) and its five most recent transactions, each with description, date, and amount.
- FR-2.3 Cards are identified by issuer and masked number (e.g. "Chase ••4321).
- FR-2.4 Pending transactions appear in the list and are labeled as pending.
- FR-2.5 When no credit cards are connected, the widget shows an empty state with a "Connect card" action.
- FR-2.6 The widget shows the Last updated time (see FR-4).

### FR-3: Connecting, repairing, and disconnecting

- FR-3.1 The user can connect a bank or credit card from within the corresponding widget (Bank Accounts / Credit Cards).
- FR-3.2 The connection flow happens through the institution's own sign-in and authorization screens; bank credentials are never typed into Bradley OS.
- FR-3.3 When a connection is marked Needs attention, the widget clearly identifies it and offers a repair (reauthorize) action.
- FR-3.4 Completing a repair restores automatic updates without creating a duplicate connection, and the connection's accounts, balances, and transactions remain intact.
- FR-3.5 The user can disconnect a connection from within the widget. Disconnecting requires an explicit confirmation and removes that connection's accounts, balances, and transactions from the app.
- FR-3.6 If a disconnect attempt fails, the app tells the user so, and the connection remains in place for retry.
- FR-3.7 Adding the new widgets never resets the user's saved board arrangement; they join the board without disturbing existing panel positions.

### FR-4: Data updates, connection health, and app sessions

- FR-4.1 Widget data updates automatically — typically a few times per day — without any user action.
- FR-4.2 Each widget shows the Last updated time so the user can tell how fresh the data is.
- FR-4.3 The user can request an immediate update check from either widget; it returns the newest data available, which may be unchanged since the last check.
- FR-4.4 The app asks the user to reauthorize a connection only when the bank or the connection service signals that the connection is broken or about to expire. The app never prompts for re-login on its own schedule, and never ties reauthorization to the user's Bradley OS sign-in.
- FR-4.5 When a connection needs attention, its widget keeps showing the last known data but clearly labels it as outdated rather than hiding it or presenting it as current.
- FR-4.6 Signing out of Bradley OS, or an expired app session, never disconnects bank connections; after the user signs back in, balances and transactions are available as before.
- FR-4.7 Routine app reauthentication (e.g. the Google sign-in flow) never requires re-entering bank credentials or reauthorizing connections.

### FR-5: Transaction details page (draft — pending confirmation)

- FR-5.1 From the Bank Accounts or Credit Cards widget, the user can open a details view for one bank account or credit card showing that account's transactions beyond the five most recent.
- FR-5.2 The details view lists transactions newest first (description, date, amount, pending label), loaded in pages as the user scrolls or pages, back to the history retained from connection time (Open Question 2).
- FR-5.3 The details view shows the data the app has already synchronized; opening it does not require contacting the bank.
- FR-5.4 The details view is a simple chronological list. Search, filtering, categories, and insights stay out of scope.

FR-5 is an exploration raised in review, not yet a confirmed requirement — confirm it alongside the Open Questions before implementation.

## Non-Functional Requirements

### NFR-1: Security and privacy

- NFR-1.1 Bank credentials are never entered into or stored by Bradley OS; sign-in happens through the institution's own screens.
- NFR-1.2 Only masked account identifiers are shown to the user; full account, card, and routing numbers are never stored or displayed.
- NFR-1.3 Financial data is accessible only to the signed-in owner.
- NFR-1.4 Financial data is not retained in the browser beyond what the current view needs; it is not cached across sessions or pages.
- NFR-1.5 On confirmed disconnect, the app removes its copy of that connection's data from the app.

### NFR-2: Freshness and accuracy

- NFR-2.1 Balances and transactions reflect the institution's records as of the last successful update, and the widget states when that was (FR-4.2 makes this visible).
- NFR-2.2 Amounts are formatted as currency, with money in and out distinguishable at a glance.
- NFR-2.3 Pending transactions are labeled pending and never shown as confirmed.

### NFR-3: Performance

- NFR-3.1 The two finance widgets never block the rest of the board from rendering; the board displays loading or empty states while financial data loads, and other panels remain usable meanwhile.
- NFR-3.2 A data update check never blocks other board interactions.

### NFR-4: Usability

- NFR-4.1 Transaction rows are consistent across both widgets (description or merchant, date, amount, pending label).
- NFR-4.2 Both widgets follow the existing board visual language (matching panel style, empty states, and typography).

## Out of Scope for MVP

- Credit-card due dates, minimum payments, statement balances, and APRs
- Bank-provided PDF statements, statement downloads
- Budgeting, spending categories, or spending insights
- Paying cards, transferring money, or any money movement
- Transaction search and spending insights (the widgets show the five most recent; history beyond that appears only in the FR-5 details list, if confirmed)
- Display of account or routing numbers
- Multiple users or shared access

## Open Questions

1. **Bank widget's "five most recent transactions": the spec assumes they are the five most recent across all connected bank accounts combined.** The alternative is five per account, which implies per-account sections. Confirm before implementation.
2. **How much transaction history the app should retain from connection time** (e.g. 90 days, 1 year, or up to 2 years). Not visible in these widgets (they show five), but it determines what a future history/search feature can offer. Confirm before implementation.
3. **Exact Bradley OS app-session durations.** Research recommended a 24-hour maximum session and 30-minute idle timeout — app sessions only; they never affect bank connections (FR-4.6/4.7). Confirm these values.
4. **Whether to build the transaction details page (draft FR-5).** It would make the retained history (Open Question 2) user-visible rather than stored-but-hidden. Confirm before implementation.