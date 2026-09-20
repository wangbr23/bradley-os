"use server";

import { eq } from "drizzle-orm";
import { CountryCode, Products } from "plaid";

import { db } from "@/lib/db/client";
import { plaidItems } from "@/lib/db/schema";
import { requireOwner } from "@/lib/auth/require-owner";
import { getPlaidClient } from "@/lib/plaid/client";
import { decryptAccessToken } from "@/lib/plaid/crypto";

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
