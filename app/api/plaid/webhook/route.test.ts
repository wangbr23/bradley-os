import { createHash } from "node:crypto";

import { eq } from "drizzle-orm";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { plaidItems } from "@/lib/db/schema";
import { createTestDb } from "@/lib/db/test-harness";

vi.mock("server-only", () => ({}));

const KID = "route-test-kid";
const BASE_TIME = new Date("2026-09-20T08:00:00.000Z");

let db: Awaited<ReturnType<typeof createTestDb>>;
let route: typeof import("./route");
let privateKey: CryptoKey;
let jwksCalls: string[];

function webhookBody(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    webhook_type: "TRANSACTIONS",
    webhook_code: "TRANSACTIONS_UPDATED",
    item_id: "item-1",
    ...overrides,
  });
}

function bodyHash(rawBody: string) {
  return createHash("sha256").update(rawBody).digest("hex");
}

async function signToken(rawBody: string) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ iat: now, request_body_sha256: bodyHash(rawBody) })
    .setProtectedHeader({ alg: "ES256", kid: KID })
    .sign(privateKey);
}

function webhookRequest(rawBody: string, verification: string | null = null) {
  return new NextRequest("http://localhost/api/plaid/webhook", {
    method: "POST",
    ...(verification ? { headers: { "Plaid-Verification": verification } } : {}),
    body: rawBody,
  });
}

async function seedItem(id: string, overrides: Partial<typeof plaidItems.$inferInsert> = {}) {
  await db.insert(plaidItems).values({
    id,
    institutionId: `institution-${id}`,
    institutionName: id,
    encryptedAccessToken: "encrypted-test-token",
    status: "healthy",
    lastErrorCode: null,
    consentExpiresAt: null,
    dirty: false,
    syncCursor: null,
    lastSyncAt: null,
    createdAt: BASE_TIME,
    updatedAt: BASE_TIME,
    ...overrides,
  });
}

async function getItem(id: string) {
  const [item] = await db.select().from(plaidItems).where(eq(plaidItems.id, id));
  return item;
}

async function postVerified(rawBody: string) {
  return route.POST(webhookRequest(rawBody, await signToken(rawBody)));
}

describe("POST /api/plaid/webhook", () => {
  beforeEach(async () => {
    db = await createTestDb();
    const keyPair = await generateKeyPair("ES256");
    privateKey = keyPair.privateKey;
    const publicJwk = await exportJWK(keyPair.publicKey);
    jwksCalls = [];

    vi.stubGlobal("fetch", async (url: string) => {
      jwksCalls.push(url);
      if (url.includes(KID)) {
        return Response.json({ keys: [{ ...publicJwk, kid: KID }] });
      }
      return new Response(null, { status: 404 });
    });

    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.resetModules();
    vi.doMock("@/lib/db/client", () => ({ db }));
    route = await import("./route");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("exports POST only so Next.js answers 405 for other methods", () => {
    const methods = route as unknown as Record<string, unknown>;
    expect(methods.GET).toBeUndefined();
    expect(methods.PUT).toBeUndefined();
    expect(methods.DELETE).toBeUndefined();
  });

  it("answers 401 with an empty body and no state change when verification fails", async () => {
    await seedItem("item-1");
    const rawBody = webhookBody();

    const response = await route.POST(webhookRequest(rawBody, "not-a-jwt"));

    expect(response.status).toBe(401);
    expect(await response.text()).toBe("");
    expect(await getItem("item-1")).toMatchObject({
      dirty: false,
      status: "healthy",
      updatedAt: BASE_TIME,
    });
  });

  it("marks the item dirty for a verified transactions webhook", async () => {
    await seedItem("item-1");

    const response = await postVerified(webhookBody());

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");
    expect(await getItem("item-1")).toMatchObject({
      dirty: true,
      status: "healthy",
      lastErrorCode: null,
      consentExpiresAt: null,
    });
  });

  it("treats a duplicate delivery as a no-op", async () => {
    await seedItem("item-1");
    const rawBody = webhookBody();
    const verification = await signToken(rawBody);

    await route.POST(webhookRequest(rawBody, verification));
    const afterFirst = await getItem("item-1");
    const response = await route.POST(webhookRequest(rawBody, verification));
    const afterSecond = await getItem("item-1");

    expect(response.status).toBe(200);
    expect({ ...afterSecond, updatedAt: 0 }).toEqual({ ...afterFirst, updatedAt: 0 });
  });

  it("answers 200 for an unknown item and creates nothing", async () => {
    const rawBody = webhookBody({ item_id: "item-ghost" });

    const response = await postVerified(rawBody);

    expect(response.status).toBe(200);
    expect(await db.select().from(plaidItems)).toHaveLength(0);
  });

  it("marks needs_attention with the error code on an ERROR webhook", async () => {
    await seedItem("item-1");
    const rawBody = webhookBody({
      webhook_type: "ITEM",
      webhook_code: "ERROR",
      error: { error_code: "ITEM_LOGIN_REQUIRED" },
    });

    const response = await postVerified(rawBody);

    expect(response.status).toBe(200);
    expect(await getItem("item-1")).toMatchObject({
      status: "needs_attention",
      lastErrorCode: "ITEM_LOGIN_REQUIRED",
      dirty: false,
    });
  });

  it("stores consent expiry on a PENDING_EXPIRATION webhook", async () => {
    await seedItem("item-1");
    const rawBody = webhookBody({
      webhook_type: "ITEM",
      webhook_code: "PENDING_EXPIRATION",
      consent_expiration_time: "2026-11-01T00:00:00Z",
    });

    const response = await postVerified(rawBody);

    expect(response.status).toBe(200);
    expect(await getItem("item-1")).toMatchObject({
      status: "needs_attention",
      consentExpiresAt: new Date("2026-11-01T00:00:00Z"),
    });
  });

  it("marks needs_attention without touching consent expiry on PENDING_DISCONNECT", async () => {
    const existingExpiry = new Date("2026-10-01T00:00:00.000Z");
    await seedItem("item-1", { consentExpiresAt: existingExpiry });
    const rawBody = webhookBody({
      webhook_type: "ITEM",
      webhook_code: "PENDING_DISCONNECT",
    });

    const response = await postVerified(rawBody);

    expect(response.status).toBe(200);
    expect(await getItem("item-1")).toMatchObject({
      status: "needs_attention",
      consentExpiresAt: existingExpiry,
    });
  });

  it("heals the item on a LOGIN_REPAIRED webhook", async () => {
    await seedItem("item-1", {
      status: "needs_attention",
      lastErrorCode: "ITEM_LOGIN_REQUIRED",
      consentExpiresAt: new Date("2026-10-01T00:00:00.000Z"),
    });
    const rawBody = webhookBody({
      webhook_type: "ITEM",
      webhook_code: "LOGIN_REPAIRED",
    });

    const response = await postVerified(rawBody);

    expect(response.status).toBe(200);
    expect(await getItem("item-1")).toMatchObject({
      status: "healthy",
      lastErrorCode: null,
      consentExpiresAt: null,
    });
  });

  it("answers 200 without changes for an unrecognized code", async () => {
    await seedItem("item-1");
    const rawBody = webhookBody({ webhook_code: "SOMETHING_UNRECOGNIZED" });

    const response = await postVerified(rawBody);

    expect(response.status).toBe(200);
    expect(await getItem("item-1")).toMatchObject({
      dirty: false,
      status: "healthy",
      updatedAt: BASE_TIME,
    });
  });

  it("rejects an oversized body with 413 before verifying", async () => {
    const response = await route.POST(webhookRequest("x".repeat(10_001), "ignored"));

    expect(response.status).toBe(413);
    expect(await response.text()).toBe("");
    expect(jwksCalls).toHaveLength(0);
  });

  it("rejects a lying content-length with 413 after reading", async () => {
    const request = new NextRequest("http://localhost/api/plaid/webhook", {
      method: "POST",
      headers: { "content-length": "5", "Plaid-Verification": "ignored" },
      body: "x".repeat(10_001),
    });

    const response = await route.POST(request);

    expect(response.status).toBe(413);
    expect(jwksCalls).toHaveLength(0);
  });
});
