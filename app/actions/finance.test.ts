import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

import { financialAccounts, plaidItems } from "@/lib/db/schema";
import { createTestDb } from "@/lib/db/test-harness";
import { decryptAccessToken, encryptAccessToken } from "@/lib/plaid/crypto";

vi.mock("server-only", () => ({}));

const {
  linkTokenCreateMock,
  itemPublicTokenExchangeMock,
  itemGetMock,
  accountsGetMock,
  itemRemoveMock,
  transactionsSyncMock,
  getFinanceSnapshotMock,
  requireOwnerMock,
} = vi.hoisted(() => ({
  linkTokenCreateMock: vi.fn(),
  itemPublicTokenExchangeMock: vi.fn(),
  itemGetMock: vi.fn(),
  accountsGetMock: vi.fn(),
  itemRemoveMock: vi.fn(),
  transactionsSyncMock: vi.fn(),
  getFinanceSnapshotMock: vi.fn(),
  requireOwnerMock: vi.fn(),
}));

vi.mock("@/lib/plaid/client", () => ({
  getPlaidClient: () => ({
    linkTokenCreate: linkTokenCreateMock,
    itemPublicTokenExchange: itemPublicTokenExchangeMock,
    itemGet: itemGetMock,
    accountsGet: accountsGetMock,
    itemRemove: itemRemoveMock,
    transactionsSync: transactionsSyncMock,
  }),
}));

vi.mock("@/lib/plaid/snapshot", () => ({
  getFinanceSnapshot: getFinanceSnapshotMock,
}));

vi.mock("@/lib/auth/require-owner", () => ({ requireOwner: requireOwnerMock }));

const ACCESS_TOKEN = "access-sandbox-test";
const ENCRYPTION_KEY = "11".repeat(32);
const LINK_TOKEN = "link-sandbox-token";
const NEW_ACCESS_TOKEN = "access-sandbox-exchanged";
const NEW_ITEM_ID = "item-new";

let db: Awaited<ReturnType<typeof createTestDb>>;
let createLinkToken: (typeof import("./finance"))["createLinkToken"];
let repairItem: (typeof import("./finance"))["repairItem"];
let exchangePublicToken: (typeof import("./finance"))["exchangePublicToken"];
let syncDirtyItems: (typeof import("./finance"))["syncDirtyItems"];
let syncNow: (typeof import("./finance"))["syncNow"];
let syncItem: (typeof import("./finance"))["syncItem"];

const SNAPSHOT = { marker: "finance-snapshot" };

function plaidResponse() {
  return {
    data: { link_token: LINK_TOKEN, expiration: "2026-09-20T13:00:00Z" },
  };
}

function exchangeResponse() {
  return {
    data: {
      access_token: NEW_ACCESS_TOKEN,
      item_id: NEW_ITEM_ID,
      request_id: "req-exchange",
    },
  };
}

function itemGetResponse(institutionId = "ins_2", institutionName = "Second Bank") {
  return {
    data: {
      item: {
        item_id: NEW_ITEM_ID,
        institution_id: institutionId,
        institution_name: institutionName,
      },
      request_id: "req-item",
    },
  };
}

function accountsGetResponse() {
  return {
    data: {
      accounts: [
        {
          account_id: "acc-1",
          name: "Checking",
          mask: "1234",
          type: "depository",
          subtype: "checking",
          balances: {
            current: 100.5,
            available: 90.5,
            iso_currency_code: "USD",
            unofficial_currency_code: null,
          },
        },
        {
          account_id: "acc-2",
          name: "Savings",
          mask: null,
          type: "depository",
          subtype: null,
          balances: {
            current: null,
            available: 10,
            iso_currency_code: null,
            unofficial_currency_code: null,
          },
        },
      ],
      request_id: "req-accounts",
    },
  };
}

function transactionSyncResponse() {
  return {
    data: {
      added: [],
      modified: [],
      removed: [],
      accounts: [],
      next_cursor: "cursor-1",
      has_more: false,
    },
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

describe("exchangePublicToken", () => {
  beforeEach(setupAction);

  it("exchanges the public token, stores the item and accounts, and runs the initial sync", async () => {
    await expect(exchangePublicToken("public-token-1")).resolves.toEqual({
      itemId: NEW_ITEM_ID,
    });

    expect(itemPublicTokenExchangeMock).toHaveBeenCalledWith({
      public_token: "public-token-1",
    });
    expect(itemGetMock).toHaveBeenCalledWith({
      access_token: NEW_ACCESS_TOKEN,
    });
    expect(accountsGetMock).toHaveBeenCalledWith({
      access_token: NEW_ACCESS_TOKEN,
    });
    expect(itemRemoveMock).not.toHaveBeenCalled();
    expect(transactionsSyncMock).toHaveBeenCalledTimes(1);
    expect(transactionsSyncMock).toHaveBeenCalledWith({
      access_token: NEW_ACCESS_TOKEN,
      count: 100,
    });

    const [storedItem] = await db
      .select()
      .from(plaidItems)
      .where(eq(plaidItems.id, NEW_ITEM_ID));
    expect(storedItem).toEqual(
      expect.objectContaining({
        institutionId: "ins_2",
        institutionName: "Second Bank",
        status: "healthy",
        dirty: false,
        syncCursor: "cursor-1",
      }),
    );
    expect(storedItem.lastSyncAt).not.toBeNull();
    expect(decryptAccessToken(storedItem.encryptedAccessToken)).toBe(
      NEW_ACCESS_TOKEN,
    );

    const accounts = await db.select().from(financialAccounts);
    expect(accounts).toHaveLength(2);
    expect(accounts[0]).toEqual(
      expect.objectContaining({
        id: "acc-1",
        itemId: NEW_ITEM_ID,
        name: "Checking",
        mask: "1234",
        type: "depository",
        subtype: "checking",
        currentBalance: 100.5,
        availableBalance: 90.5,
        currencyCode: "USD",
      }),
    );
    expect(accounts[1]).toEqual(
      expect.objectContaining({
        id: "acc-2",
        name: "Savings",
        mask: null,
        subtype: null,
        currentBalance: null,
        availableBalance: 10,
        currencyCode: "USD",
      }),
    );
  });

  it("removes the new token and returns the existing item when the institution is already connected", async () => {
    await seedItem();
    itemGetMock.mockResolvedValue(itemGetResponse("ins_1", "Test Bank"));

    await expect(exchangePublicToken("public-token-1")).resolves.toEqual({
      itemId: "item-1",
    });

    expect(itemRemoveMock).toHaveBeenCalledWith({
      access_token: NEW_ACCESS_TOKEN,
    });
    expect(transactionsSyncMock).not.toHaveBeenCalled();

    const [onlyItem] = await db.select().from(plaidItems);
    expect(onlyItem.id).toBe("item-1");
    expect(decryptAccessToken(onlyItem.encryptedAccessToken)).toBe(ACCESS_TOKEN);
    expect(await db.select().from(financialAccounts)).toHaveLength(0);
  });

  it("requires the owner before contacting Plaid", async () => {
    requireOwnerMock.mockRejectedValue(new Error("Unauthorized"));

    await expect(exchangePublicToken("public-token-1")).rejects.toThrow(
      "Unauthorized",
    );
    expect(itemPublicTokenExchangeMock).not.toHaveBeenCalled();
    expect(await db.select().from(plaidItems)).toHaveLength(0);
  });

  it("propagates public-token exchange failures without storing anything", async () => {
    itemPublicTokenExchangeMock.mockRejectedValue(new Error("exchange failed"));

    await expect(exchangePublicToken("public-token-1")).rejects.toThrow(
      "exchange failed",
    );
    expect(itemGetMock).not.toHaveBeenCalled();
    expect(itemRemoveMock).not.toHaveBeenCalled();
    expect(await db.select().from(plaidItems)).toHaveLength(0);
  });

  it("throws when Plaid omits the institution metadata", async () => {
    itemGetMock.mockResolvedValue({
      data: {
        item: {
          item_id: NEW_ITEM_ID,
          institution_id: null,
          institution_name: null,
        },
        request_id: "req-item",
      },
    });

    await expect(exchangePublicToken("public-token-1")).rejects.toThrow(
      `Plaid returned no institution metadata for item ${NEW_ITEM_ID}`,
    );
    expect(itemRemoveMock).not.toHaveBeenCalled();
    expect(await db.select().from(plaidItems)).toHaveLength(0);
  });

  it("propagates a first-sync failure and marks the stored item for attention", async () => {
    const plaidError = Object.assign(new Error("ITEM_LOGIN_REQUIRED"), {
      response: {
        data: { error_code: "ITEM_LOGIN_REQUIRED", error_code_reason: null },
      },
    });
    transactionsSyncMock.mockRejectedValue(plaidError);

    await expect(exchangePublicToken("public-token-1")).rejects.toThrow(
      "ITEM_LOGIN_REQUIRED",
    );

    const [storedItem] = await db
      .select()
      .from(plaidItems)
      .where(eq(plaidItems.id, NEW_ITEM_ID));
    expect(storedItem.status).toBe("needs_attention");
    expect(storedItem.lastErrorCode).toBe("ITEM_LOGIN_REQUIRED");
  });
});

describe("syncDirtyItems", () => {
  beforeEach(setupAction);

  it("syncs only the items marked dirty and returns the fresh snapshot", async () => {
    await seedItem({
      id: "item-dirty",
      institutionId: "ins_1",
      dirty: true,
      encryptedAccessToken: encryptAccessToken("access-dirty"),
    });
    await seedItem({
      id: "item-clean",
      institutionId: "ins_2",
      dirty: false,
      encryptedAccessToken: encryptAccessToken("access-clean"),
    });

    await expect(syncDirtyItems()).resolves.toBe(SNAPSHOT);

    expect(transactionsSyncMock).toHaveBeenCalledTimes(1);
    expect(transactionsSyncMock).toHaveBeenCalledWith({
      access_token: "access-dirty",
      count: 100,
    });
  });

  it("returns the current snapshot when a sync fails instead of throwing", async () => {
    await seedItem({
      id: "item-dirty",
      institutionId: "ins_1",
      dirty: true,
      encryptedAccessToken: encryptAccessToken("access-dirty"),
    });
    transactionsSyncMock.mockRejectedValue(new Error("rate limited"));

    await expect(syncDirtyItems()).resolves.toBe(SNAPSHOT);
  });

  it("requires the owner before touching Plaid", async () => {
    requireOwnerMock.mockRejectedValue(new Error("Unauthorized"));

    await expect(syncDirtyItems()).rejects.toThrow("Unauthorized");
    expect(transactionsSyncMock).not.toHaveBeenCalled();
  });
});

describe("syncNow", () => {
  beforeEach(setupAction);

  it("syncs every healthy item regardless of dirty and skips needs_attention items", async () => {
    await seedItem({
      id: "item-healthy-dirty",
      institutionId: "ins_1",
      dirty: true,
      encryptedAccessToken: encryptAccessToken("access-1"),
    });
    await seedItem({
      id: "item-healthy-clean",
      institutionId: "ins_2",
      dirty: false,
      encryptedAccessToken: encryptAccessToken("access-2"),
    });
    await seedItem({
      id: "item-attention",
      institutionId: "ins_3",
      status: "needs_attention",
      dirty: true,
      encryptedAccessToken: encryptAccessToken("access-3"),
    });

    await expect(syncNow()).resolves.toBe(SNAPSHOT);

    expect(transactionsSyncMock).toHaveBeenCalledTimes(2);
    const tokens = transactionsSyncMock.mock.calls.map((call) => call[0].access_token);
    expect(tokens).toEqual(["access-1", "access-2"]);
  });

  it("propagates a sync failure", async () => {
    await seedItem({ id: "item-1", institutionId: "ins_1" });
    transactionsSyncMock.mockRejectedValue(new Error("sync failed"));

    await expect(syncNow()).rejects.toThrow("sync failed");
  });

  it("requires the owner before touching Plaid", async () => {
    requireOwnerMock.mockRejectedValue(new Error("Unauthorized"));

    await expect(syncNow()).rejects.toThrow("Unauthorized");
    expect(transactionsSyncMock).not.toHaveBeenCalled();
  });
});

describe("syncItem", () => {
  beforeEach(setupAction);

  it("syncs the repaired item even when it needs attention and returns the snapshot", async () => {
    await seedItem({
      id: "item-repairing",
      institutionId: "ins_1",
      status: "needs_attention",
      lastErrorCode: "ITEM_LOGIN_REQUIRED",
    });

    await expect(syncItem("item-repairing")).resolves.toBe(SNAPSHOT);
    expect(transactionsSyncMock).toHaveBeenCalledWith({
      access_token: ACCESS_TOKEN,
      count: 100,
    });
  });

  it("throws for an unknown item without contacting Plaid", async () => {
    await expect(syncItem("item-unknown")).rejects.toThrow(
      "Plaid item not found: item-unknown",
    );
    expect(transactionsSyncMock).not.toHaveBeenCalled();
  });

  it("requires the owner before touching Plaid", async () => {
    requireOwnerMock.mockRejectedValue(new Error("Unauthorized"));

    await expect(syncItem("item-1")).rejects.toThrow("Unauthorized");
    expect(transactionsSyncMock).not.toHaveBeenCalled();
  });
});

async function setupAction() {
  db = await createTestDb();
  vi.stubEnv("FINANCE_ENCRYPTION_KEY", ENCRYPTION_KEY);
  vi.resetModules();
  vi.doMock("@/lib/db/client", () => ({ db }));
  requireOwnerMock.mockReset().mockResolvedValue(undefined);
  linkTokenCreateMock.mockReset().mockResolvedValue(plaidResponse());
  itemPublicTokenExchangeMock.mockReset().mockResolvedValue(exchangeResponse());
  itemGetMock.mockReset().mockResolvedValue(itemGetResponse());
  accountsGetMock.mockReset().mockResolvedValue(accountsGetResponse());
  itemRemoveMock.mockReset().mockResolvedValue({ data: { request_id: "req-remove" } });
  transactionsSyncMock.mockReset().mockResolvedValue(transactionSyncResponse());
  getFinanceSnapshotMock.mockReset().mockResolvedValue(SNAPSHOT);
  ({ createLinkToken, repairItem, exchangePublicToken, syncDirtyItems, syncNow, syncItem } =
    await import("./finance"));
}

afterEach(() => {
  vi.unstubAllEnvs();
});
