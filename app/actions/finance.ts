"use server";

import { eq } from "drizzle-orm";
import { CountryCode, Products } from "plaid";

import { db } from "@/lib/db/client";
import { financialAccounts, plaidItems } from "@/lib/db/schema";
import { requireOwner } from "@/lib/auth/require-owner";
import { getPlaidClient } from "@/lib/plaid/client";
import { decryptAccessToken, encryptAccessToken } from "@/lib/plaid/crypto";
import { getFinanceSnapshot, type FinanceSnapshot } from "@/lib/plaid/snapshot";
import { getPlaidError, runItemSync } from "@/lib/plaid/sync";

// The 730-day history window is fixed at first link (product spec OQ2) and
// cannot be raised later without deleting and relinking the Item.
const HISTORY_DAYS = 730;

function baseLinkTokenRequest() {
  return {
    client_name: "Bradley OS",
    language: "en",
    country_codes: [CountryCode.Us],
    user: { client_user_id: "bradley-os-owner" },
  };
}

export async function createLinkToken(): Promise<string> {
  await requireOwner();

  const response = await getPlaidClient().linkTokenCreate({
    ...baseLinkTokenRequest(),
    products: [Products.Transactions],
    transactions: { days_requested: HISTORY_DAYS },
    ...(process.env.PLAID_WEBHOOK_URL ? { webhook: process.env.PLAID_WEBHOOK_URL } : {}),
    ...(process.env.PLAID_REDIRECT_URI ? { redirect_uri: process.env.PLAID_REDIRECT_URI } : {}),
  });

  return response.data.link_token;
}

export async function repairItem(itemId: string): Promise<string> {
  await requireOwner();

  const [item] = await db
    .select({ encryptedAccessToken: plaidItems.encryptedAccessToken })
    .from(plaidItems)
    .where(eq(plaidItems.id, itemId));

  if (!item) {
    throw new Error(`Plaid item not found: ${itemId}`);
  }

  // Update mode binds the token to the item's unchanged access_token. Products
  // stay omitted so the re-auth flow cannot initialize a new product (Plaid's
  // update-mode guidance).
  const response = await getPlaidClient().linkTokenCreate({
    ...baseLinkTokenRequest(),
    access_token: decryptAccessToken(item.encryptedAccessToken),
  });

  return response.data.link_token;
}

export async function exchangePublicToken(
  publicToken: string,
): Promise<{ itemId: string }> {
  await requireOwner();

  const client = getPlaidClient();
  const exchange = await client.itemPublicTokenExchange({
    public_token: publicToken,
  });
  const accessToken = exchange.data.access_token;
  const itemId = exchange.data.item_id;

  // Institution metadata is required for the duplicate check and the item row;
  // Plaid only omits it for items created without an institution connection
  // (never the Link connect flow), so treat absence as a failure.
  const item = await client.itemGet({ access_token: accessToken });
  const { institution_id: institutionId, institution_name: institutionName } =
    item.data.item;
  if (!institutionId || !institutionName) {
    throw new Error(`Plaid returned no institution metadata for item ${itemId}`);
  }

  const accounts = await client.accountsGet({ access_token: accessToken });

  // Duplicate-Item prevention (LLD §6.8): a second Link at the same
  // institution is removed in Plaid so it cannot become a billed orphan, and
  // the existing local item is returned untouched.
  const [existing] = await db
    .select({ id: plaidItems.id })
    .from(plaidItems)
    .where(eq(plaidItems.institutionId, institutionId));

  if (existing) {
    await client.itemRemove({ access_token: accessToken });
    return { itemId: existing.id };
  }

  const now = new Date();
  await db.transaction(async (tx) => {
    await tx.insert(plaidItems).values({
      id: itemId,
      institutionId,
      institutionName,
      encryptedAccessToken: encryptAccessToken(accessToken),
      status: "healthy",
      lastErrorCode: null,
      consentExpiresAt: null,
      dirty: false,
      syncCursor: null,
      lastSyncAt: null,
      createdAt: now,
      updatedAt: now,
    });
    await tx.insert(financialAccounts).values(
      accounts.data.accounts.map((account) => ({
        id: account.account_id,
        itemId,
        name: account.name,
        mask: account.mask,
        type: account.type,
        subtype: account.subtype,
        currentBalance: account.balances.current,
        availableBalance: account.balances.available,
        // currencyCode is notNull and the connect scope is US-only, so fall
        // back to USD when Plaid omits both currency fields.
        currencyCode:
          account.balances.iso_currency_code ??
          account.balances.unofficial_currency_code ??
          "USD",
        updatedAt: now,
      })),
    );
  });

  // Initial sync (LLD §5.1): a first-sync failure rethrows after marking the
  // item needs_attention for auth-class errors, so the connect error surfaces
  // and a later repair can heal the stored item.
  await runItemSync(itemId);

  return { itemId };
}

// Post-mount trigger (LLD §6.4): the webhook only sets dirty=1, so the next
// board load syncs every flagged item. Never throws to the client — a failing
// item stays dirty for the next trigger and the current snapshot is returned.
export async function syncDirtyItems(): Promise<FinanceSnapshot> {
  await requireOwner();

  const items = await db
    .select({ id: plaidItems.id })
    .from(plaidItems)
    .where(eq(plaidItems.dirty, true));

  for (const item of items) {
    try {
      await runItemSync(item.id);
    } catch {
      // Item state was already handled by runItemSync (auth errors mark
      // needs_attention); the failure is not surfaced to the client.
    }
  }

  return getFinanceSnapshot();
}

// Manual refresh (FR-4.3): syncs every healthy item regardless of dirty. A
// needs_attention item is skipped — its data cannot move until repair (§5.6).
export async function syncNow(): Promise<FinanceSnapshot> {
  await requireOwner();

  const items = await db
    .select({ id: plaidItems.id })
    .from(plaidItems)
    .where(eq(plaidItems.status, "healthy"));

  for (const item of items) {
    await runItemSync(item.id);
  }

  return getFinanceSnapshot();
}

// Post-repair sync (§5.4): runs the same sync for the one item just repaired,
// regardless of its status — a successful sync is what heals the item.
export async function syncItem(itemId: string): Promise<FinanceSnapshot> {
  await requireOwner();

  await runItemSync(itemId);

  return getFinanceSnapshot();
}

// Disconnect (LLD §5.5): /item/remove first, then purge the local row so the
// schema's cascade wipes accounts and transactions. A Plaid "item not found"
// response still counts as success — a retry after a failed purge finds the
// item already removed on Plaid's side and must be able to finish the purge.
export async function disconnectItem(itemId: string): Promise<void> {
  await requireOwner();

  const [item] = await db
    .select({ encryptedAccessToken: plaidItems.encryptedAccessToken })
    .from(plaidItems)
    .where(eq(plaidItems.id, itemId));

  if (!item) {
    throw new Error(`Plaid item not found: ${itemId}`);
  }

  try {
    await getPlaidClient().itemRemove({
      access_token: decryptAccessToken(item.encryptedAccessToken),
    });
  } catch (error) {
    if (getPlaidError(error)?.error_code !== "ITEM_NOT_FOUND") {
      throw error;
    }
  }

  await db.delete(plaidItems).where(eq(plaidItems.id, itemId));
}
