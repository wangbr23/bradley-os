"use client";

import { formatMoney, formatTransactionDate } from "@/lib/finance/format";
import type { TransactionView } from "@/lib/plaid/snapshot";
import styles from "./finance.module.css";

// Shared transaction row for both finance panels (LLD §6.14): stored negative
// = money in → explicit + prefix in accent; stored positive = money out →
// plain. Pending transactions get a label chip (FR-1.4/2.4).
export function TransactionRow({ transaction }: { transaction: TransactionView }) {
  const moneyIn = transaction.amount < 0;

  return (
    <div className="panel-row">
      <p className="row-main">
        {transaction.name}
        <span className="row-sub"> — {formatTransactionDate(transaction.date)}</span>
      </p>
      <p className={styles.amountCell}>
        <span className={styles.amount} data-in={moneyIn}>
          {moneyIn ? "+" : ""}
          {formatMoney(transaction.amount, transaction.currencyCode)}
        </span>
        {transaction.pending ? <span className={styles.pending}>pending</span> : null}
      </p>
    </div>
  );
}