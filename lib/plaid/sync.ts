import "server-only";

import { and, eq, inArray, sql } from "drizzle-orm";
import type { RemovedTransaction, Transaction } from "plaid";

import { db } from "@/lib/db/client";
import { financialAccounts, financialTransactions, plaidItems } from "@/lib/db/schema";
import { getPlaidClient } from "./client";
import { decryptAccessToken } from "./crypto";

const PAGE_SIZE = 100;
const WRITE_CHUNK_SIZE = 100;

// Only Plaid signals that update-mode Link can actually repair mark the item
// needs_attention. Rate limits, institution outages, transport failures, and
// configuration errors leave item state untouched so the next trigger retries
// from the stored cursor. An OAuth error_code_reason is the more specific
// code and is stored in its place when present.
const ATTENTION_ERROR_CODES = new Set(["ITEM_LOGIN_REQUIRED", "INVALID_CREDENTIALS"]);
const ATTENTION_ERROR_REASONS = new Set([
  "OAUTH_INVALID_TOKEN",
  "OAUTH_CONSENT_EXPIRED",
  "OAUTH_USER_REVOKED",
]);

type FinancialTransactionInsert = typeof financialTransactions.$inferInsert;

interface PlaidErrorShape {
  error_code: string;
  error_code_reason?: string | null;
}

function chunk<T>(values: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    batches.push(values.slice(index, index + size));
  }
  return batches;
}

// The Plaid SDK rejects with an Axios error whose response.data holds the
// Plaid error object; Axios is only a transitive dependency, so inspect the
// shape structurally instead of importing AxiosError.
export function getPlaidError(error: unknown): PlaidErrorShape | null {
  if (typeof error !== "object" || error === null) {
    return null;
  }

  const data = (error as { response?: { data?: unknown } }).response?.data;
  if (typeof data !== "object" || data === null) {
    return null;
  }

  const candidate = data as Partial<PlaidErrorShape>;
  return typeof candidate.error_code === "string" ? (candidate as PlaidErrorShape) : null;
}

function getAttentionCode(error: unknown): string | null {
  const plaidError = getPlaidError(error);

  if (!plaidError) {
    return null;
  }
  if (plaidError.error_code_reason && ATTENTION_ERROR_REASONS.has(plaidError.error_code_reason)) {
    return plaidError.error_code_reason;
  }

  return ATTENTION_ERROR_CODES.has(plaidError.error_code) ? plaidError.error_code : null;
}

function mapTransaction(transaction: Transaction, updatedAt: Date): FinancialTransactionInsert {
  return {
    id: transaction.transaction_id,
    accountId: transaction.account_id,
    amount: transaction.amount,
    date: transaction.date,
    name: transaction.name,
    pending: transaction.pending,
    updatedAt,
  };
}

// Sync engine for one Plaid item (finance LLD §5.2): stage every page of
// /transactions/sync in memory, then apply all row changes plus the final
// cursor in one Drizzle transaction (invariant S2 — a partial run can never
// advance the cursor). Calls no owner check and returns no snapshot; server
// actions own both boundaries. Caller contract: regular sync triggers only
// select healthy items, so a successful sync of a needs_attention item means
// update-mode repair just completed and the item may be healed.
export async function runItemSync(itemId: string): Promise<void> {
  const [item] = await db
    .select({
      encryptedAccessToken: plaidItems.encryptedAccessToken,
      syncCursor: plaidItems.syncCursor,
      status: plaidItems.status,
    })
    .from(plaidItems)
    .where(eq(plaidItems.id, itemId));

  if (!item) {
    throw new Error(`Plaid item not found: ${itemId}`);
  }

  const accessToken = decryptAccessToken(item.encryptedAccessToken);
  const client = getPlaidClient();

  const added: Transaction[] = [];
  const modified: Transaction[] = [];
  const removed: RemovedTransaction[] = [];
  let cursor: string | null = item.syncCursor;
  let hasMore = true;

  try {
    while (hasMore) {
      const response = await client.transactionsSync({
        access_token: accessToken,
        count: PAGE_SIZE,
        ...(cursor === null ? {} : { cursor }),
      });
      const data = response.data;

      added.push(...data.added);
      modified.push(...data.modified);
      removed.push(...data.removed);

      cursor = data.next_cursor;
      hasMore = data.has_more;
    }
  } catch (error) {
    const attentionCode = getAttentionCode(error);

    if (attentionCode) {
      // Separate minimal update: the cursor, dirty flag, lastSyncAt, consent
      // expiry, and all cached data stay exactly as they were (LLD §6.12).
      await db
        .update(plaidItems)
        .set({ status: "needs_attention", lastErrorCode: attentionCode, updatedAt: new Date() })
        .where(eq(plaidItems.id, itemId));
    }

    throw error;
  }

  // Fetch authoritative balances for all accounts on this item, not just
  // those with transaction changes — /transactions/sync only returns accounts
  // tied to returned transactions, so balance-only changes were missed.
  const allAccounts = await client.accountsGet({ access_token: accessToken });

  const now = new Date();
  await db.transaction(async (tx) => {
    const transactionRows = [...added, ...modified].map((transaction) =>
      mapTransaction(transaction, now),
    );
    for (const batch of chunk(transactionRows, WRITE_CHUNK_SIZE)) {
      await tx
        .insert(financialTransactions)
        .values(batch)
        .onConflictDoUpdate({
          target: financialTransactions.id,
          set: {
            accountId: sql`excluded.account_id`,
            amount: sql`excluded.amount`,
            date: sql`excluded.date`,
            name: sql`excluded.name`,
            pending: sql`excluded.pending`,
            updatedAt: sql`excluded.updated_at`,
          },
        });
    }

    // Removal runs after upserts so a removed id wins if Plaid ever reports
    // the same transaction in multiple collections of one run.
    const removedIds = removed.map((entry) => entry.transaction_id);
    for (const batch of chunk(removedIds, WRITE_CHUNK_SIZE)) {
      await tx.delete(financialTransactions).where(inArray(financialTransactions.id, batch));
    }

    for (const account of allAccounts.data.accounts) {
      await tx
        .update(financialAccounts)
        .set({
          name: account.name,
          mask: account.mask,
          type: account.type,
          subtype: account.subtype,
          currentBalance: account.balances.current,
          availableBalance: account.balances.available,
          ...(account.balances.iso_currency_code
            ? { currencyCode: account.balances.iso_currency_code }
            : {}),
          updatedAt: now,
        })
        .where(and(eq(financialAccounts.id, account.account_id), eq(financialAccounts.itemId, itemId)));
    }

    // lastErrorCode is only ever set by auth-class signals, so a fully
    // successful sync always clears it. Consent expiry is only cleared on the
    // post-repair transition (needs_attention → healthy).
    await tx
      .update(plaidItems)
      .set({
        syncCursor: cursor,
        lastSyncAt: now,
        dirty: false,
        updatedAt: now,
        status: "healthy",
        lastErrorCode: null,
        ...(item.status === "needs_attention" ? { consentExpiresAt: null } : {}),
      })
      .where(eq(plaidItems.id, itemId));
  });
}
