import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { financialAccounts, financialTransactions, plaidItems } from "@/lib/db/schema";
import { createTestDb } from "@/lib/db/test-harness";
import { encryptAccessToken } from "@/lib/plaid/crypto";

vi.mock("server-only", () => ({}));

const { transactionsSyncMock, accountsGetMock, transactionsRefreshMock } = vi.hoisted(() => ({
  transactionsSyncMock: vi.fn(),
  accountsGetMock: vi.fn(),
  transactionsRefreshMock: vi.fn(),
}));

vi.mock("@/lib/plaid/client", () => ({
  getPlaidClient: () => ({
    transactionsSync: transactionsSyncMock,
    accountsGet: accountsGetMock,
    transactionsRefresh: transactionsRefreshMock,
  }),
}));

const NOW = new Date("2026-09-18T12:00:00.000Z");
const OLD = new Date("2026-01-01T00:00:00.000Z");
const EXPIRY = new Date("2026-10-01T00:00:00.000Z");
const ACCESS_TOKEN = "access-sandbox-test";
const ENCRYPTION_KEY = "11".repeat(32);

let db: Awaited<ReturnType<typeof createTestDb>>;
let runItemSync: (itemId: string) => Promise<void>;

function plaidPage(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      accounts: [],
      added: [],
      modified: [],
      removed: [],
      next_cursor: "",
      has_more: false,
      ...overrides,
    },
  };
}

function plaidTransaction(overrides: Record<string, unknown> = {}) {
  return {
    transaction_id: "tx-add",
    account_id: "acc-1",
    amount: 20,
    date: "2026-09-10",
    name: "Paycheck",
    pending: false,
    ...overrides,
  };
}

function plaidAccount(overrides: Record<string, unknown> = {}) {
  return {
    account_id: "acc-1",
    balances: {
      current: 100.25,
      available: 50,
      iso_currency_code: "USD",
      unofficial_currency_code: null,
    },
    mask: "1234",
    name: "Checking Plus",
    type: "depository",
    subtype: "checking",
    ...overrides,
  };
}

function plaidFailure(errorCode: string, extra: Record<string, unknown> = {}) {
  const error = new Error(`Plaid error: ${errorCode}`);
  Object.assign(error, {
    response: {
      data: { error_type: "ITEM_ERROR", error_code: errorCode, error_message: errorCode, ...extra },
    },
  });
  return error;
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
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  });
}

async function seedAccount(overrides: Partial<typeof financialAccounts.$inferInsert> = {}) {
  await db.insert(financialAccounts).values({
    id: "acc-1",
    itemId: "item-1",
    name: "Old Name",
    mask: "0001",
    type: "depository",
    subtype: "checking",
    currentBalance: 10,
    availableBalance: 5,
    currencyCode: "USD",
    updatedAt: OLD,
    ...overrides,
  });
}

async function seedTransaction(overrides: Partial<typeof financialTransactions.$inferInsert> = {}) {
  await db.insert(financialTransactions).values({
    id: "tx-1",
    accountId: "acc-1",
    amount: 5,
    date: "2026-08-01",
    name: "Old Coffee",
    pending: false,
    updatedAt: OLD,
    ...overrides,
  });
}

describe("runItemSync", () => {
  beforeEach(async () => {
    vi.stubEnv("FINANCE_ENCRYPTION_KEY", ENCRYPTION_KEY);
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    db = await createTestDb();
    transactionsSyncMock.mockReset();
    accountsGetMock.mockReset();
    transactionsRefreshMock.mockReset();
    accountsGetMock.mockResolvedValue({ data: { accounts: [] } });
    transactionsRefreshMock.mockResolvedValue({ data: {} });
    vi.resetModules();
    vi.doMock("@/lib/db/client", () => ({ db }));
    ({ runItemSync } = await import("@/lib/plaid/sync"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("applies multi-page deltas and persists everything in one final commit", async () => {
    await seedItem({ dirty: true, syncCursor: "cursor-0", lastSyncAt: OLD });
    await seedAccount();
    await seedAccount({ id: "acc-2", name: "Savings", mask: "0002", currentBalance: 1, availableBalance: null });
    await seedTransaction({ id: "tx-mod", amount: 5, name: "Old Coffee" });
    await seedTransaction({ id: "tx-del", amount: 9, date: "2026-08-02", name: "Doomed" });
    await seedTransaction({ id: "tx-keep", amount: 3, date: "2026-08-03", name: "Keeper" });

    accountsGetMock.mockResolvedValue({
      data: {
        accounts: [
          plaidAccount(),
          plaidAccount({
            account_id: "acc-2",
            name: "Savings Renamed",
            balances: { current: 2, available: null, iso_currency_code: null, unofficial_currency_code: null },
          }),
        ],
      },
    });

    transactionsSyncMock
      .mockImplementationOnce(async () =>
        plaidPage({
          accounts: [
            plaidAccount(),
            plaidAccount({
              account_id: "acc-2",
              name: "Savings Renamed",
              balances: { current: 2, available: null, iso_currency_code: null, unofficial_currency_code: null },
            }),
          ],
          added: [plaidTransaction()],
          modified: [plaidTransaction({ transaction_id: "tx-mod", amount: 5.25, name: "Coffee Refund", pending: true })],
          next_cursor: "cursor-1",
          has_more: true,
        }),
      )
      .mockImplementationOnce(async () => {
        // Page one must still be unstaged while the later page is fetched.
        const rows = await db.select().from(financialTransactions);
        expect(rows.map((row) => row.id).sort()).toEqual(["tx-del", "tx-keep", "tx-mod"]);
        const [item] = await db.select().from(plaidItems).where(eq(plaidItems.id, "item-1"));
        expect(item.syncCursor).toBe("cursor-0");
        return plaidPage({ removed: [{ transaction_id: "tx-del", account_id: "acc-1" }], next_cursor: "cursor-2" });
      });

    await runItemSync("item-1");

    expect(transactionsSyncMock).toHaveBeenCalledTimes(2);
    expect(transactionsSyncMock.mock.calls[0][0]).toEqual({
      access_token: ACCESS_TOKEN,
      count: 100,
      cursor: "cursor-0",
    });
    expect(transactionsSyncMock.mock.calls[1][0]).toEqual({
      access_token: ACCESS_TOKEN,
      count: 100,
      cursor: "cursor-1",
    });

    const rows = await db.select().from(financialTransactions);
    const byId = new Map(rows.map((row) => [row.id, row]));
    expect(rows).toHaveLength(3);
    expect(byId.get("tx-add")).toMatchObject({
      accountId: "acc-1",
      amount: 20,
      date: "2026-09-10",
      name: "Paycheck",
      pending: false,
      updatedAt: NOW,
    });
    expect(byId.get("tx-mod")).toMatchObject({
      amount: 5.25,
      name: "Coffee Refund",
      pending: true,
      updatedAt: NOW,
    });
    expect(byId.get("tx-keep")).toMatchObject({ amount: 3, name: "Keeper", updatedAt: OLD });
    expect(byId.has("tx-del")).toBe(false);

    const accounts = await db.select().from(financialAccounts);
    const accountById = new Map(accounts.map((account) => [account.id, account]));
    expect(accountById.get("acc-1")).toMatchObject({
      name: "Checking Plus",
      mask: "1234",
      currentBalance: 100.25,
      availableBalance: 50,
      currencyCode: "USD",
      updatedAt: NOW,
    });
    expect(accountById.get("acc-2")).toMatchObject({
      name: "Savings Renamed",
      currentBalance: 2,
      currencyCode: "USD",
      updatedAt: NOW,
    });

    const [item] = await db.select().from(plaidItems).where(eq(plaidItems.id, "item-1"));
    expect(item).toMatchObject({ syncCursor: "cursor-2", dirty: false, status: "healthy", lastErrorCode: null });
    expect(item.lastSyncAt).toEqual(NOW);
  });

  it("preserves the stored cursor and data when a later page fails", async () => {
    await seedItem({ dirty: true, syncCursor: "cursor-0", lastSyncAt: OLD });
    await seedAccount();

    transactionsSyncMock
      .mockImplementationOnce(async () =>
        plaidPage({ added: [plaidTransaction()], next_cursor: "cursor-1", has_more: true }),
      )
      .mockImplementationOnce(async () => {
        throw plaidFailure("TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION", {
          error_type: "TRANSACTIONS_ERROR",
        });
      });

    await expect(runItemSync("item-1")).rejects.toThrow("TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION");

    expect(await db.select().from(financialTransactions)).toHaveLength(0);
    const [item] = await db.select().from(plaidItems).where(eq(plaidItems.id, "item-1"));
    expect(item).toMatchObject({
      syncCursor: "cursor-0",
      dirty: true,
      status: "healthy",
      lastErrorCode: null,
    });
    expect(item.lastSyncAt).toEqual(OLD);
  });

  it("re-applying the same deltas is idempotent", async () => {
    await seedItem();
    await seedAccount();
    transactionsSyncMock.mockResolvedValue(
      plaidPage({
        added: [plaidTransaction()],
        removed: [{ transaction_id: "tx-gone", account_id: "acc-1" }],
        next_cursor: "cursor-9",
      }),
    );

    await runItemSync("item-1");
    await runItemSync("item-1");

    const rows = await db.select().from(financialTransactions);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: "tx-add", amount: 20, name: "Paycheck" });
    const [item] = await db.select().from(plaidItems).where(eq(plaidItems.id, "item-1"));
    expect(item.syncCursor).toBe("cursor-9");
  });

  it.each([
    ["ITEM_LOGIN_REQUIRED", {}, "ITEM_LOGIN_REQUIRED"],
    ["INVALID_CREDENTIALS", {}, "INVALID_CREDENTIALS"],
    ["ITEM_LOGIN_REQUIRED", { error_code_reason: "OAUTH_CONSENT_EXPIRED" }, "OAUTH_CONSENT_EXPIRED"],
    ["ITEM_LOGIN_REQUIRED", { error_code_reason: "OAUTH_USER_REVOKED" }, "OAUTH_USER_REVOKED"],
  ])("marks the item needs_attention for %s", async (errorCode, extra, expectedCode) => {
    await seedItem({ dirty: true, syncCursor: "cursor-0", lastSyncAt: OLD });
    await seedAccount();
    await seedTransaction();
    transactionsSyncMock.mockRejectedValue(plaidFailure(errorCode, extra));

    await expect(runItemSync("item-1")).rejects.toThrow(errorCode);

    const [item] = await db.select().from(plaidItems).where(eq(plaidItems.id, "item-1"));
    expect(item).toMatchObject({
      status: "needs_attention",
      lastErrorCode: expectedCode,
      syncCursor: "cursor-0",
      dirty: true,
    });
    expect(item.lastSyncAt).toEqual(OLD);
    expect(item.consentExpiresAt).toBeNull();
    expect(await db.select().from(financialTransactions)).toHaveLength(1);
  });

  it("leaves everything untouched on a transient Plaid error", async () => {
    await seedItem({ syncCursor: "cursor-0" });
    await seedAccount();
    transactionsSyncMock.mockRejectedValue(
      plaidFailure("INSTITUTION_NOT_RESPONDING", { error_type: "INSTITUTION_ERROR" }),
    );

    await expect(runItemSync("item-1")).rejects.toThrow("INSTITUTION_NOT_RESPONDING");

    const [item] = await db.select().from(plaidItems).where(eq(plaidItems.id, "item-1"));
    expect(item).toMatchObject({
      status: "healthy",
      lastErrorCode: null,
      syncCursor: "cursor-0",
      dirty: false,
    });
    expect(item.lastSyncAt).toBeNull();
  });

  it("heals a needs_attention item after a successful post-repair sync", async () => {
    await seedItem({
      status: "needs_attention",
      lastErrorCode: "ITEM_LOGIN_REQUIRED",
      consentExpiresAt: EXPIRY,
      dirty: true,
      syncCursor: "cursor-0",
      lastSyncAt: OLD,
    });
    await seedAccount();
    transactionsSyncMock.mockResolvedValue(plaidPage({ next_cursor: "cursor-1" }));

    await runItemSync("item-1");

    const [item] = await db.select().from(plaidItems).where(eq(plaidItems.id, "item-1"));
    expect(item).toMatchObject({
      status: "healthy",
      lastErrorCode: null,
      consentExpiresAt: null,
      dirty: false,
      syncCursor: "cursor-1",
    });
    expect(item.lastSyncAt).toEqual(NOW);
  });

  it("calls transactionsRefresh when refresh option is set", async () => {
    await seedItem();
    await seedAccount();
    transactionsSyncMock.mockResolvedValue(plaidPage({ next_cursor: "cursor-1" }));

    await runItemSync("item-1", { refresh: true });

    expect(transactionsRefreshMock).toHaveBeenCalledWith({ access_token: ACCESS_TOKEN });
    expect(transactionsSyncMock).toHaveBeenCalled();
  });

  it("skips transactionsRefresh by default", async () => {
    await seedItem();
    await seedAccount();
    transactionsSyncMock.mockResolvedValue(plaidPage({ next_cursor: "cursor-1" }));

    await runItemSync("item-1");

    expect(transactionsRefreshMock).not.toHaveBeenCalled();
  });

  it("fails fast for an unknown item without calling Plaid", async () => {
    await expect(runItemSync("item-missing")).rejects.toThrow("not found");
    expect(transactionsSyncMock).not.toHaveBeenCalled();
  });
});
