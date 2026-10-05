import { beforeEach, describe, expect, it, vi } from "vitest";

import { financialAccounts, financialTransactions, plaidItems } from "@/lib/db/schema";
import { createTestDb } from "@/lib/db/test-harness";

vi.mock("server-only", () => ({}));

const BASE_TIME = new Date("2026-09-18T08:00:00.000Z");
const BANK_LAST_SYNC = new Date("2026-09-18T10:00:00.000Z");
const CARD_LAST_SYNC = new Date("2026-09-18T11:00:00.000Z");
const UNUSED_LAST_SYNC = new Date("2026-09-18T12:00:00.000Z");
const CONSENT_EXPIRY = new Date("2026-10-01T00:00:00.000Z");

let db: Awaited<ReturnType<typeof createTestDb>>;
let getFinanceSnapshot: typeof import("./snapshot").getFinanceSnapshot;

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

async function seedAccount(
  id: string,
  itemId: string,
  type: "depository" | "credit",
  overrides: Partial<typeof financialAccounts.$inferInsert> = {},
) {
  await db.insert(financialAccounts).values({
    id,
    itemId,
    name: id,
    mask: "1234",
    type,
    subtype: type === "depository" ? "checking" : "credit card",
    currentBalance: 0,
    availableBalance: null,
    currencyCode: "USD",
    updatedAt: BASE_TIME,
    ...overrides,
  });
}

async function seedTransaction(
  id: string,
  accountId: string,
  date: string,
  overrides: Partial<typeof financialTransactions.$inferInsert> = {},
) {
  await db.insert(financialTransactions).values({
    id,
    accountId,
    amount: 1,
    date,
    name: id,
    pending: false,
    updatedAt: BASE_TIME,
    ...overrides,
  });
}

describe("getFinanceSnapshot", () => {
  beforeEach(async () => {
    db = await createTestDb();
    vi.resetModules();
    vi.doMock("@/lib/db/client", () => ({ db }));
    ({ getFinanceSnapshot } = await import("@/lib/plaid/snapshot"));
  });

  it("returns an empty snapshot when no finance data exists", async () => {
    await expect(getFinanceSnapshot()).resolves.toEqual({
      bank: { accounts: [], combinedBalance: 0, recent: [], lastSyncAt: null },
      cards: { accounts: [], perAccount: [], lastSyncAt: null },
      items: [],
    });
  });

  it("shapes account, transaction, item, and per-widget sync data", async () => {
    await seedItem("bank-old", { institutionName: "Bank Old", lastSyncAt: BASE_TIME });
    await seedItem("bank-new", {
      institutionName: "Bank New",
      status: "needs_attention",
      lastErrorCode: "ITEM_LOGIN_REQUIRED",
      consentExpiresAt: CONSENT_EXPIRY,
      lastSyncAt: BANK_LAST_SYNC,
    });
    await seedItem("card-old", { institutionName: "Card Old", lastSyncAt: BASE_TIME });
    await seedItem("card-new", { institutionName: "Card New", lastSyncAt: CARD_LAST_SYNC });
    await seedItem("unused", { institutionName: "Unused", lastSyncAt: UNUSED_LAST_SYNC });

    await seedAccount("bank-checking", "bank-old", "depository", {
      name: "Checking",
      currentBalance: 100,
      availableBalance: 80,
    });
    await seedAccount("bank-savings", "bank-new", "depository", {
      name: "Savings",
      mask: null,
      currentBalance: 25.5,
    });
    await seedAccount("bank-unknown", "bank-new", "depository", {
      name: "Unknown balance",
      currentBalance: null,
    });
    await seedAccount("card-alpha", "card-old", "credit", { name: "Alpha Card", currentBalance: 400 });
    await seedAccount("card-beta", "card-new", "credit", { name: "Beta Card", currentBalance: 800 });
    await seedAccount("card-empty", "card-new", "credit", { name: "Empty Card", currentBalance: 0 });

    await seedTransaction("bank-newest", "bank-checking", "2026-09-18", {
      amount: 20,
      pending: true,
      updatedAt: new Date("2026-09-18T12:00:00.000Z"),
    });
    await seedTransaction("bank-next", "bank-savings", "2026-09-18", {
      updatedAt: new Date("2026-09-18T11:00:00.000Z"),
    });
    await seedTransaction("bank-a-tie", "bank-checking", "2026-09-17");
    await seedTransaction("bank-b-tie", "bank-savings", "2026-09-17");
    await seedTransaction("bank-fifth", "bank-checking", "2026-09-16");
    await seedTransaction("bank-sixth", "bank-checking", "2026-09-15");

    for (let day = 1; day <= 6; day += 1) {
      await seedTransaction(`alpha-${day}`, "card-alpha", `2026-09-0${day}`, { amount: day });
    }
    await seedTransaction("beta-1", "card-beta", "2026-09-07");
    await seedTransaction("beta-2", "card-beta", "2026-09-08");

    const snapshot = await getFinanceSnapshot();

    // Checking uses available (80); Savings has none and falls back to current (25.5).
    expect(snapshot.bank.combinedBalance).toBe(105.5);
    expect(snapshot.bank.lastSyncAt).toEqual(BANK_LAST_SYNC);
    expect(snapshot.bank.accounts).toEqual([
      {
        id: "bank-checking",
        itemId: "bank-old",
        name: "Checking",
        mask: "1234",
        currentBalance: 100,
        availableBalance: 80,
        currencyCode: "USD",
      },
      {
        id: "bank-savings",
        itemId: "bank-new",
        name: "Savings",
        mask: null,
        currentBalance: 25.5,
        availableBalance: null,
        currencyCode: "USD",
      },
      {
        id: "bank-unknown",
        itemId: "bank-new",
        name: "Unknown balance",
        mask: "1234",
        currentBalance: null,
        availableBalance: null,
        currencyCode: "USD",
      },
    ]);
    expect(snapshot.bank.recent.map((transaction) => transaction.id)).toEqual([
      "bank-newest",
      "bank-next",
      "bank-a-tie",
      "bank-b-tie",
      "bank-fifth",
    ]);
    expect(snapshot.bank.recent[0]).toMatchObject({ amount: 20, pending: true, currencyCode: "USD" });

    expect(snapshot.cards.lastSyncAt).toEqual(CARD_LAST_SYNC);
    expect(snapshot.cards.accounts.map((account) => account.id)).toEqual(["card-alpha", "card-beta", "card-empty"]);
    expect(snapshot.cards.perAccount).toEqual([
      {
        accountId: "card-alpha",
        transactions: expect.arrayContaining([
          expect.objectContaining({ id: "alpha-6", amount: 6, currencyCode: "USD" }),
        ]),
      },
      {
        accountId: "card-beta",
        transactions: [
          expect.objectContaining({ id: "beta-2" }),
          expect.objectContaining({ id: "beta-1" }),
        ],
      },
      { accountId: "card-empty", transactions: [] },
    ]);
    expect(snapshot.cards.perAccount[0].transactions.map((transaction) => transaction.id)).toEqual([
      "alpha-6",
      "alpha-5",
      "alpha-4",
      "alpha-3",
      "alpha-2",
    ]);

    expect(snapshot.items).toContainEqual({
      id: "bank-new",
      institutionName: "Bank New",
      status: "needs_attention",
      lastErrorCode: "ITEM_LOGIN_REQUIRED",
      consentExpiresAt: CONSENT_EXPIRY,
    });
    expect(snapshot.items).toHaveLength(5);
  });
});
