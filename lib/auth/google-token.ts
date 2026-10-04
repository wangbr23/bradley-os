import "server-only";

import { getToken } from "next-auth/jwt";
import { headers } from "next/headers";

import { authSecret } from "@/auth";

// Auth.js derives the JWT encryption key from the session cookie name, so
// getToken must be handed the exact cookie the runtime issued: unprefixed on
// http (dev), "__Secure-" prefixed on https.
const SESSION_COOKIE_NAMES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
];

export type GoogleToken = {
  accessToken: string | null;
  error: "RefreshAccessTokenError" | null;
};

export async function readGoogleToken(requestHeaders: Headers): Promise<GoogleToken> {
  const cookieNames = (requestHeaders.get("cookie") ?? "")
    .split(";")
    .map((part) => part.trim().split("=")[0]);
  const cookieName = SESSION_COOKIE_NAMES.find((name) =>
    cookieNames.includes(name),
  );
  if (!cookieName) {
    return { accessToken: null, error: null };
  }

  const token = await getToken({
    req: { headers: requestHeaders },
    secret: authSecret,
    cookieName,
  });
  return {
    accessToken: token?.googleAccessToken ?? null,
    error: token?.googleTokenError ?? null,
  };
}

export async function getGoogleToken(): Promise<GoogleToken> {
  return readGoogleToken(new Headers(await headers()));
}