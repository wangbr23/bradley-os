import { beforeEach, describe, expect, it, vi } from "vitest";
import { encode } from "next-auth/jwt";

import { readGoogleToken } from "./google-token";

vi.mock("server-only", () => ({}));
vi.mock("@/auth", () => ({
  authSecret: "test-auth-secret-0123456789abcdef",
}));

const SECRET = "test-auth-secret-0123456789abcdef";

function headersWithCookie(name: string, value: string) {
  return new Headers({ cookie: `${name}=${value}` });
}

async function headersWithSessionJwt(
  token: Record<string, unknown>,
  name = "authjs.session-token",
) {
  const jwt = await encode({ token, secret: SECRET, salt: name });
  return headersWithCookie(name, jwt);
}

describe("readGoogleToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns nulls when no session cookie is present", async () => {
    await expect(readGoogleToken(new Headers())).resolves.toEqual({
      accessToken: null,
      error: null,
    });
  });

  it("ignores cookies other than the session token", async () => {
    await expect(
      readGoogleToken(headersWithCookie("authjs.callback-url", "/")),
    ).resolves.toEqual({ accessToken: null, error: null });
  });

  it("reads the Google access token from the session JWT", async () => {
    const headers = await headersWithSessionJwt({
      sub: "owner",
      email: "owner@example.com",
      googleAccessToken: "at-123",
      googleAccessTokenExpiresAt: Math.floor(Date.now() / 1000) + 3600,
    });

    await expect(readGoogleToken(headers)).resolves.toEqual({
      accessToken: "at-123",
      error: null,
    });
  });

  it("reads the __Secure- prefixed session cookie name", async () => {
    const headers = await headersWithSessionJwt(
      { googleAccessToken: "at-secure" },
      "__Secure-authjs.session-token",
    );

    await expect(readGoogleToken(headers)).resolves.toEqual({
      accessToken: "at-secure",
      error: null,
    });
  });

  it("surfaces the refresh-error flag from the session JWT", async () => {
    const headers = await headersWithSessionJwt({
      googleTokenError: "RefreshAccessTokenError",
    });

    await expect(readGoogleToken(headers)).resolves.toEqual({
      accessToken: null,
      error: "RefreshAccessTokenError",
    });
  });

  it("returns nulls when the session cookie cannot be decrypted", async () => {
    await expect(
      readGoogleToken(headersWithCookie("authjs.session-token", "not-a-jwt")),
    ).resolves.toEqual({ accessToken: null, error: null });
  });
});