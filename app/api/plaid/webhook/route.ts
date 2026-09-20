import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db/client";
import { plaidItems } from "@/lib/db/schema";
import { verifyPlaidWebhook, type PlaidWebhook } from "@/lib/plaid/webhook";

const MAX_BODY_SIZE = 10_000;

// Verified-webhook → item transition (finance LLD §6.12). Null = unrecognized
// code: answer 200 without touching state.
function getTransition(
  webhook: PlaidWebhook,
): Partial<typeof plaidItems.$inferInsert> | null {
  switch (webhook.webhookCode) {
    case "TRANSACTIONS_UPDATED":
    case "INITIAL_UPDATE":
    case "HISTORICAL_UPDATE":
    case "TRANSACTIONS_REMOVED":
      return { dirty: true };
    case "ERROR":
      return {
        status: "needs_attention",
        lastErrorCode: webhook.error?.errorCode ?? null,
      };
    case "PENDING_EXPIRATION": {
      const expiry = webhook.consentExpirationTime
        ? new Date(webhook.consentExpirationTime)
        : null;
      return {
        status: "needs_attention",
        consentExpiresAt: expiry && !Number.isNaN(expiry.getTime()) ? expiry : null,
      };
    }
    case "PENDING_DISCONNECT":
      return { status: "needs_attention" };
    case "LOGIN_REPAIRED":
      return { status: "healthy", lastErrorCode: null, consentExpiresAt: null };
    default:
      return null;
  }
}

// The app's only unauthenticated route: Plaid is the caller (finance LLD §4.3).
// 200 for everything verified — Plaid retries non-2xx, so a dead item_id must
// not loop; unknown items and codes are logged and dropped instead.
export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length"));
  if (contentLength > MAX_BODY_SIZE) {
    return new NextResponse(null, { status: 413 });
  }

  const rawBody = await request.text();
  if (rawBody.length > MAX_BODY_SIZE) {
    return new NextResponse(null, { status: 413 });
  }

  const webhook = await verifyPlaidWebhook(
    rawBody,
    request.headers.get("Plaid-Verification"),
  );
  if (!webhook) {
    return new NextResponse(null, { status: 401 });
  }

  const transition = getTransition(webhook);
  if (!transition) {
    console.log(
      `plaid webhook ignored: ${webhook.webhookType}/${webhook.webhookCode} item ${webhook.itemId}`,
    );
    return new NextResponse(null, { status: 200 });
  }

  const updated = await db
    .update(plaidItems)
    .set({ ...transition, updatedAt: new Date() })
    .where(eq(plaidItems.id, webhook.itemId))
    .returning({ id: plaidItems.id });

  if (updated.length === 0) {
    console.log(
      `plaid webhook unknown item: ${webhook.webhookType}/${webhook.webhookCode} item ${webhook.itemId}`,
    );
  }

  return new NextResponse(null, { status: 200 });
}
