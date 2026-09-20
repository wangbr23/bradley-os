import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { plaidItems } from "@/lib/db/schema";
import { createTestDb } from "@/lib/db/test-harness";
import { encryptAccessToken } from "@/lib/plaid/crypto";

vi.mock("server-only", () => ({}));

const { linkTokenCreateMock, requireOwnerMock } = vi.hoisted(() => ({
  linkTokenCreateMock: vi.fn(),
  requireOwnerMock: vi.fn(),
}));

vi.mock("@/lib/plaid/client", () => ({
  getPlaidClient: () => ({ linkTokenCreate: linkTokenCreateMock }),
}));

vi.mock("@/lib/auth/require-owner", () => ({ requireOwner: requireOwnerMock }));

const ACCESS_TOKEN = "access-sandbox-test";
const ENCRYPTION_KEY = "11".repeat(32);
const LINK_TOKEN = "link-sandbox-token";

let db: Awaited<ReturnType<typeof createTestDb>>;
let createLinkToken: (typeof import("./finance"))["createLinkToken"];
let repairItem: (typeof import("./finance"))["repairItem"];

function plaidResponse() {
  return {
    data: { link_token: LINK_TOKEN, expiration: "2026-09-20T13:00:00Z" },
  };
}

async function seedItem(overrides: Partial<typeof plaidItems.$inferInsert> = {}) {
  await db.insert(plaidItems).values({
    id: "item-1",
    institutionId: "ins_1",
    institutionName: "Test Bank",
    encryptedAccessToken: encryptAccessToken(ACCESS_TOKEN),
    status: "healthy",
    lastErrorCode: null,
    consentExpiresAt: null,
    dirty: false,
    syncCursor: null,
    lastSyncAt: null,
    createdAt: new Date("2026-09-18T12:00:00.000Z"),
    updatedAt: new Date("2026-09-18T12:00:00.000Z"),
    ...overrides,
  });
}

describe("createLinkToken", () => {
  beforeEach(setupAction);

  it("creates a connect-mode token with the pinned parameters", async () => {
    await expect(createLinkToken()).resolves.toBe(LINK_TOKEN);

    expect(linkTokenCreateMock).toHaveBeenCalledTimes(1);
    const request = linkTokenCreateMock.mock.calls[0][0];
    expect(Object.keys(request).sort()).toEqual([
      "client_name",
      "country_codes",
      "language",
      "products",
      "transactions",
      "user",
    ]);
    expect(request).toEqual(
      expect.objectContaining({
        client_name: "Bradley OS",
        language: "en",
        country_codes: ["US"],
        user: { client_user_id: "bradley-os-owner" },
        products: ["transactions"],
        transactions: { days_requested: 730 },
      }),
    );
  });

  it("includes the webhook and redirect URI when configured", async () => {
    vi.stubEnv("PLAID_WEBHOOK_URL", "https://example.com/api/plaid/webhook");
    vi.stubEnv("PLAID_REDIRECT_URI", "https://example.com/plaid/link-return");

    await createLinkToken();

    const request = linkTokenCreateMock.mock.calls[0][0];
    expect(request.webhook).toBe("https://example.com/api/plaid/webhook");
    expect(request.redirect_uri).toBe("https://example.com/plaid/link-return");
  });

  it("requires the owner before contacting Plaid", async () => {
    requireOwnerMock.mockRejectedValue(new Error("Unauthorized"));

    await expect(createLinkToken()).rejects.toThrow("Unauthorized");
    expect(linkTokenCreateMock).not.toHaveBeenCalled();
  });

  it("propagates Plaid failures", async () => {
    linkTokenCreateMock.mockRejectedValue(new Error("invalid credentials"));

    await expect(createLinkToken()).rejects.toThrow("invalid credentials");
  });
});

describe("repairItem", () => {
  beforeEach(setupAction);

  it("creates an update-mode token bound to the item's decrypted access token", async () => {
    await seedItem();
    await expect(repairItem("item-1")).resolves.toBe(LINK_TOKEN);

    const request = linkTokenCreateMock.mock.calls[0][0];
    expect(Object.keys(request).sort()).toEqual([
      "access_token",
      "client_name",
      "country_codes",
      "language",
      "user",
    ]);
    expect(request.access_token).toBe(ACCESS_TOKEN);
  });

  it("throws for an unknown item without contacting Plaid", async () => {
    await expect(repairItem("item-unknown")).rejects.toThrow("Plaid item not found: item-unknown");
    expect(linkTokenCreateMock).not.toHaveBeenCalled();
  });

  it("requires the owner before reading the item", async () => {
    requireOwnerMock.mockRejectedValue(new Error("Unauthorized"));

    await expect(repairItem("item-1")).rejects.toThrow("Unauthorized");
    expect(linkTokenCreateMock).not.toHaveBeenCalled();
  });

  it("propagates decryption failures for a malformed stored token", async () => {
    await seedItem({ encryptedAccessToken: "not-an-encrypted-token" });

    await expect(repairItem("item-1")).rejects.toThrow(
      "Invalid encrypted Plaid access token format",
    );
    expect(linkTokenCreateMock).not.toHaveBeenCalled();
  });
});

async function setupAction() {
  db = await createTestDb();
  vi.stubEnv("FINANCE_ENCRYPTION_KEY", ENCRYPTION_KEY);
  vi.resetModules();
  vi.doMock("@/lib/db/client", () => ({ db }));
  requireOwnerMock.mockReset().mockResolvedValue(undefined);
  linkTokenCreateMock.mockReset().mockResolvedValue(plaidResponse());
  ({ createLinkToken, repairItem } = await import("./finance"));
}

afterEach(() => {
  vi.unstubAllEnvs();
});
