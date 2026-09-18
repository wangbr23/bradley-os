import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { decryptAccessToken, encryptAccessToken } from "./crypto";

vi.mock("server-only", () => ({}));

const ENCRYPTION_KEY = "01".repeat(32);
const OTHER_ENCRYPTION_KEY = "02".repeat(32);
const ACCESS_TOKEN = "access-sandbox-example";

describe("Plaid access-token encryption", () => {
  beforeEach(() => {
    vi.stubEnv("FINANCE_ENCRYPTION_KEY", ENCRYPTION_KEY);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("roundtrips access tokens in the versioned format with fresh nonces", () => {
    const firstEncrypted = encryptAccessToken(ACCESS_TOKEN);
    const secondEncrypted = encryptAccessToken(ACCESS_TOKEN);
    const [version, encodedNonce, , encodedAuthTag] = firstEncrypted.split(":");

    expect(version).toBe("v1");
    expect(firstEncrypted.split(":")).toHaveLength(4);
    expect(Buffer.from(encodedNonce, "base64")).toHaveLength(12);
    expect(Buffer.from(encodedAuthTag, "base64")).toHaveLength(16);
    expect(firstEncrypted).not.toContain(ACCESS_TOKEN);
    expect(firstEncrypted).not.toBe(secondEncrypted);
    expect(decryptAccessToken(firstEncrypted)).toBe(ACCESS_TOKEN);
    expect(decryptAccessToken(secondEncrypted)).toBe(ACCESS_TOKEN);
  });

  it("rejects tampered ciphertext", () => {
    const parts = encryptAccessToken(ACCESS_TOKEN).split(":");
    const ciphertext = Buffer.from(parts[2], "base64");
    ciphertext[0] ^= 1;
    parts[2] = ciphertext.toString("base64");

    expect(() => decryptAccessToken(parts.join(":"))).toThrow();
  });

  it("rejects a tampered authentication tag", () => {
    const parts = encryptAccessToken(ACCESS_TOKEN).split(":");
    const authTag = Buffer.from(parts[3], "base64");
    authTag[0] ^= 1;
    parts[3] = authTag.toString("base64");

    expect(() => decryptAccessToken(parts.join(":"))).toThrow();
  });

  it("rejects a different encryption key", () => {
    const encryptedAccessToken = encryptAccessToken(ACCESS_TOKEN);
    vi.stubEnv("FINANCE_ENCRYPTION_KEY", OTHER_ENCRYPTION_KEY);

    expect(() => decryptAccessToken(encryptedAccessToken)).toThrow();
  });

  it("rejects an unknown format version", () => {
    const encryptedAccessToken = encryptAccessToken(ACCESS_TOKEN);

    expect(() =>
      decryptAccessToken(encryptedAccessToken.replace(/^v1:/, "v2:")),
    ).toThrow("Unsupported encrypted Plaid access token version: v2");
  });

  it.each([
    "v1:too:few",
    "v1:too:many:parts:here",
    "v1:YQ==:YQ==:YQ==",
  ])(
    "rejects malformed payload %s",
    (encryptedAccessToken) => {
      expect(() => decryptAccessToken(encryptedAccessToken)).toThrow(
        "Invalid encrypted Plaid access token format",
      );
    },
  );

  it("rejects a missing encryption key", () => {
    const encryptedAccessToken = encryptAccessToken(ACCESS_TOKEN);
    vi.stubEnv("FINANCE_ENCRYPTION_KEY", undefined);

    expect(() => encryptAccessToken(ACCESS_TOKEN)).toThrow(
      "FINANCE_ENCRYPTION_KEY",
    );
    expect(() => decryptAccessToken(encryptedAccessToken)).toThrow(
      "FINANCE_ENCRYPTION_KEY",
    );
  });

  it.each(["01", "z1".repeat(32)])(
    "rejects malformed encryption key %s",
    (key) => {
      vi.stubEnv("FINANCE_ENCRYPTION_KEY", key);

      expect(() => encryptAccessToken(ACCESS_TOKEN)).toThrow(
        "FINANCE_ENCRYPTION_KEY",
      );
    },
  );
});
