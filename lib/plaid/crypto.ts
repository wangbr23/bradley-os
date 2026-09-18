import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const FORMAT_VERSION = "v1";
const NONCE_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_PATTERN = /^[0-9a-fA-F]{64}$/;

function getEncryptionKey() {
  const key = process.env.FINANCE_ENCRYPTION_KEY;

  if (!key || !KEY_PATTERN.test(key)) {
    throw new Error(
      "FINANCE_ENCRYPTION_KEY must be exactly 32 bytes encoded as 64 hexadecimal characters",
    );
  }

  return Buffer.from(key, "hex");
}

export function encryptAccessToken(accessToken: string) {
  const nonce = randomBytes(NONCE_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), nonce);
  const ciphertext = Buffer.concat([
    cipher.update(accessToken, "utf8"),
    cipher.final(),
  ]);

  return [
    FORMAT_VERSION,
    nonce.toString("base64"),
    ciphertext.toString("base64"),
    cipher.getAuthTag().toString("base64"),
  ].join(":");
}

export function decryptAccessToken(encryptedAccessToken: string) {
  const parts = encryptedAccessToken.split(":");

  if (parts.length !== 4) {
    throw new Error("Invalid encrypted Plaid access token format");
  }

  const [version, encodedNonce, encodedCiphertext, encodedAuthTag] = parts;

  if (version !== FORMAT_VERSION) {
    throw new Error(`Unsupported encrypted Plaid access token version: ${version}`);
  }

  const nonce = Buffer.from(encodedNonce, "base64");
  const ciphertext = Buffer.from(encodedCiphertext, "base64");
  const authTag = Buffer.from(encodedAuthTag, "base64");

  if (nonce.length !== NONCE_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error("Invalid encrypted Plaid access token format");
  }

  const decipher = createDecipheriv(ALGORITHM, getEncryptionKey(), nonce);
  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}
