import "server-only";

import { asc, desc, eq, lte, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { financialAccounts, financialTransactions, plaidItems } from "@/lib/db/schema";

const RECENT_TRANSACTION_LIMIT = 5;

export interface AccountView {
  id: string;
  itemId: string;
  name: string;
  mask: string | null;
  currentBalance: number | null;
  availableBalance: number | null;
  currencyCode: string;
}

export interface TransactionView {
  id: string;
  name: string;
  date: string;
  amount: number;
  pending: boolean;
  currencyCode: string;
}

export interface ItemView {
  id: string;
  institutionName: string;
  status: "healthy" | "needs_attention";
  lastErrorCode: string | null;
  consentExpiresAt: Date | null;
}

export interface FinanceSnapshot {
  bank: {
    accounts: AccountView[];
    combinedBalance: number;
    recent: TransactionView[];
    lastSyncAt: Date | null;
  };
  cards: {
    accounts: AccountView[];
    perAccount: { accountId: string; transactions: TransactionView[] }[];
    lastSyncAt: Date | null;
  };
  items: ItemView[];
}

function newestSync(rows: { lastSyncAt: Date | null }[]) {
  return rows.reduce<Date | null>((newest, row) => {
    if (!row.lastSyncAt || (newest && newest >= row.lastSyncAt)) return newest;
    return row.lastSyncAt;
  }, null);
}

export async function getFinanceSnapshot(): Promise<FinanceSnapshot> {
  const rankedCardTransactions = db
    .select({
      accountId: financialTransactions.accountId,
      id: financialTransactions.id,
      name: financialTransactions.name,
      date: financialTransactions.date,
      amount: financialTransactions.amount,
      pending: financialTransactions.pending,
      currencyCode: financialAccounts.currencyCode,
      rank: sql<number>`row_number() over (
        partition by ${financialTransactions.accountId}
        order by ${financialTransactions.date} desc, ${financialTransactions.updatedAt} desc, ${financialTransactions.id}
      )`.as("rank"),
    })
    .from(financialTransactions)
    .innerJoin(financialAccounts, eq(financialTransactions.accountId, financialAccounts.id))
    .where(eq(financialAccounts.type, "credit"))
    .as("ranked_card_transactions");

  const [accountRows, bankTransactions, cardTransactionRows, items] = await Promise.all([
    db
      .select({
        id: financialAccounts.id,
        itemId: financialAccounts.itemId,
        name: financialAccounts.name,
        mask: financialAccounts.mask,
        type: financialAccounts.type,
        currentBalance: financialAccounts.currentBalance,
        availableBalance: financialAccounts.availableBalance,
        currencyCode: financialAccounts.currencyCode,
        lastSyncAt: plaidItems.lastSyncAt,
        typeBalance:
          sql<number>`coalesce(sum(${financialAccounts.currentBalance}) over (partition by ${financialAccounts.type}), 0)`.as(
            "type_balance",
          ),
      })
      .from(financialAccounts)
      .innerJoin(plaidItems, eq(financialAccounts.itemId, plaidItems.id))
      .orderBy(asc(financialAccounts.type), asc(financialAccounts.name), asc(financialAccounts.id)),
    db
      .select({
        id: financialTransactions.id,
        name: financialTransactions.name,
        date: financialTransactions.date,
        amount: financialTransactions.amount,
        pending: financialTransactions.pending,
        currencyCode: financialAccounts.currencyCode,
      })
      .from(financialTransactions)
      .innerJoin(financialAccounts, eq(financialTransactions.accountId, financialAccounts.id))
      .where(eq(financialAccounts.type, "depository"))
      .orderBy(
        desc(financialTransactions.date),
        desc(financialTransactions.updatedAt),
        asc(financialTransactions.id),
      )
      .limit(RECENT_TRANSACTION_LIMIT),
    db
      .select({
        accountId: rankedCardTransactions.accountId,
        id: rankedCardTransactions.id,
        name: rankedCardTransactions.name,
        date: rankedCardTransactions.date,
        amount: rankedCardTransactions.amount,
        pending: rankedCardTransactions.pending,
        currencyCode: rankedCardTransactions.currencyCode,
      })
      .from(rankedCardTransactions)
      .where(lte(rankedCardTransactions.rank, RECENT_TRANSACTION_LIMIT))
      .orderBy(asc(rankedCardTransactions.accountId), asc(rankedCardTransactions.rank)),
    db
      .select({
        id: plaidItems.id,
        institutionName: plaidItems.institutionName,
        status: plaidItems.status,
        lastErrorCode: plaidItems.lastErrorCode,
        consentExpiresAt: plaidItems.consentExpiresAt,
      })
      .from(plaidItems)
      .orderBy(asc(plaidItems.institutionName), asc(plaidItems.id)),
  ]);

  const bankRows = accountRows.filter((account) => account.type === "depository");
  const cardRows = accountRows.filter((account) => account.type === "credit");
  const toAccountView = (account: (typeof accountRows)[number]): AccountView => ({
    id: account.id,
    itemId: account.itemId,
    name: account.name,
    mask: account.mask,
    currentBalance: account.currentBalance,
    availableBalance: account.availableBalance,
    currencyCode: account.currencyCode,
  });
  const cardTransactions = new Map<string, TransactionView[]>();

  for (const transaction of cardTransactionRows) {
    const { accountId, ...view } = transaction;
    const transactions = cardTransactions.get(accountId) ?? [];
    transactions.push(view);
    cardTransactions.set(accountId, transactions);
  }

  return {
    bank: {
      accounts: bankRows.map(toAccountView),
      combinedBalance: bankRows[0]?.typeBalance ?? 0,
      recent: bankTransactions,
      lastSyncAt: newestSync(bankRows),
    },
    cards: {
      accounts: cardRows.map(toAccountView),
      perAccount: cardRows.map((account) => ({
        accountId: account.id,
        transactions: cardTransactions.get(account.id) ?? [],
      })),
      lastSyncAt: newestSync(cardRows),
    },
    items,
  };
}
