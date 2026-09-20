import { createHash } from "node:crypto";

import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { verifyPlaidWebhook } from "./webhook";

vi.mock("server-only", () => ({}));

const KID = "test-kid-001";
let keyPair: Awaited<ReturnType<typeof generateKeyPair>>;
let jwksFetch: (url: string) => Promise<Response>;

function webhookBody(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    webhook_type: "TRANSACTIONS",
    webhook_code: "SYNC_UPDATES_AVAILABLE",
    item_id: "item-sandbox-123",
    ...overrides,
  });
}

function bodyHash(rawBody: string) {
  return createHash("sha256").update(rawBody).digest("hex");
}

async function signToken(
  rawBody: string,
  overrides: {
    kid?: string;
    iat?: number;
    hash?: string;
    alg?: "ES256";
    signingKey?: CryptoKey;
  } = {},
) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    iat: overrides.iat ?? now,
    request_body_sha256: overrides.hash ?? bodyHash(rawBody),
  })
    .setProtectedHeader({
      alg: overrides.alg ?? "ES256",
      kid: overrides.kid ?? KID,
    })
    .sign(overrides.signingKey ?? keyPair.privateKey);
}

function mockJwksFetch(publicJwk: Record<string, unknown>) {
  return async (url: string) => {
    if (url.includes(KID)) {
      return Response.json({ keys: [{ ...publicJwk, kid: KID }] });
    }
    return new Response(null, { status: 404 });
  };
}

describe("verifyPlaidWebhook", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-20T12:00:00Z"));
    keyPair = await generateKeyPair("ES256");
    const publicJwk = await exportJWK(keyPair.publicKey);
    jwksFetch = mockJwksFetch(publicJwk);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the parsed webhook for a valid ES256 JWT", async () => {
    const body = webhookBody();
    const token = await signToken(body);

    const result = await verifyPlaidWebhook(body, token, jwksFetch);

    expect(result).toEqual({
      webhookType: "TRANSACTIONS",
      webhookCode: "SYNC_UPDATES_AVAILABLE",
      itemId: "item-sandbox-123",
      error: undefined,
      consentExpirationTime: undefined,
    });
  });

  it("passes through error and consent_expiration_time fields", async () => {
    const body = webhookBody({
      webhook_type: "ITEM",
      webhook_code: "ERROR",
      error: { errorCode: "ITEM_LOGIN_REQUIRED" },
      consent_expiration_time: "2026-10-01T00:00:00Z",
    });
    const token = await signToken(body);

    const result = await verifyPlaidWebhook(body, token, jwksFetch);

    expect(result).toMatchObject({
      webhookType: "ITEM",
      webhookCode: "ERROR",
      error: { errorCode: "ITEM_LOGIN_REQUIRED" },
      consentExpirationTime: "2026-10-01T00:00:00Z",
    });
  });

  it("rejects a stale iat (> 5 minutes old)", async () => {
    const body = webhookBody();
    const staleIat = Math.floor(Date.now() / 1000) - 6 * 60;
    const token = await signToken(body, { iat: staleIat });

    expect(await verifyPlaidWebhook(body, token, jwksFetch)).toBeNull();
  });

  it("rejects a body-hash mismatch", async () => {
    const body = webhookBody();
    const token = await signToken(body, { hash: "a".repeat(64) });

    expect(await verifyPlaidWebhook(body, token, jwksFetch)).toBeNull();
  });

  it("rejects an oversized body", async () => {
    const body = "x".repeat(10_001);
    const token = await signToken(body);

    expect(await verifyPlaidWebhook(body, token, jwksFetch)).toBeNull();
  });

  it("rejects a missing verification header", async () => {
    expect(await verifyPlaidWebhook(webhookBody(), null, jwksFetch)).toBeNull();
  });

  it("rejects when JWKS fetch fails", async () => {
    const body = webhookBody();
    const token = await signToken(body, { kid: "unknown-kid" });

    expect(await verifyPlaidWebhook(body, token, jwksFetch)).toBeNull();
  });

  it("rejects a future iat", async () => {
    const body = webhookBody();
    const futureIat = Math.floor(Date.now() / 1000) + 60;
    const token = await signToken(body, { iat: futureIat });

    expect(await verifyPlaidWebhook(body, token, jwksFetch)).toBeNull();
  });
});
