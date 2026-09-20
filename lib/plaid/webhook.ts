import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

import { importJWK, jwtVerify } from "jose";

const MAX_BODY_SIZE = 10_000;
const IAT_FRESHNESS_SECONDS = 5 * 60;

export type PlaidWebhook = {
  webhookType: string;
  webhookCode: string;
  itemId: string;
  error?: { errorCode: string };
  consentExpirationTime?: string;
};

type FetchFn = (url: string) => Promise<Response>;

export async function verifyPlaidWebhook(
  rawBody: string,
  verificationHeader: string | null,
  fetchJwks: FetchFn = fetch,
): Promise<PlaidWebhook | null> {
  if (!verificationHeader || rawBody.length > MAX_BODY_SIZE) return null;

  try {
    const { kid } = decodeJwtHeader(verificationHeader);
    if (!kid) return null;

    const key = await fetchSigningKey(kid, fetchJwks);
    if (!key) return null;

    const { payload } = await jwtVerify(verificationHeader, key, {
      algorithms: ["ES256"],
    });

    if (!isIatFresh(payload.iat)) return null;
    if (!verifyBodyHash(rawBody, payload.request_body_sha256 as string))
      return null;

    const body = JSON.parse(rawBody);
    return {
      webhookType: body.webhook_type,
      webhookCode: body.webhook_code,
      itemId: body.item_id,
      error: body.error ?? undefined,
      consentExpirationTime: body.consent_expiration_time ?? undefined,
    };
  } catch {
    return null;
  }
}

function decodeJwtHeader(token: string): { kid?: string; alg?: string } {
  const dotIndex = token.indexOf(".");
  if (dotIndex === -1) return {};
  const headerJson = Buffer.from(token.slice(0, dotIndex), "base64url").toString("utf8");
  return JSON.parse(headerJson);
}

async function fetchSigningKey(kid: string, fetchJwks: FetchFn) {
  const url = `https://cache.plaid.com/webhooks/verification_jwks/${kid}`;
  const response = await fetchJwks(url);
  if (!response.ok) return null;

  const jwks = await response.json();
  const jwk = jwks.keys?.find((k: { kid?: string }) => k.kid === kid);
  if (!jwk) return null;

  return importJWK(jwk, "ES256");
}

function isIatFresh(iat: number | undefined): boolean {
  if (typeof iat !== "number") return false;
  const age = Math.floor(Date.now() / 1000) - iat;
  return age >= 0 && age <= IAT_FRESHNESS_SECONDS;
}

function verifyBodyHash(
  rawBody: string,
  claimedHash: string | undefined,
): boolean {
  if (typeof claimedHash !== "string") return false;
  const actual = createHash("sha256").update(rawBody).digest("hex");
  return timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(claimedHash, "hex"));
}
