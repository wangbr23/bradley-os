"use client";

import { forwardRef, type HTMLAttributes, useEffect, useState } from "react";

import {
  disconnectItem,
  syncDirtyItems,
  syncItem,
  syncNow,
} from "@/app/actions/finance";
import { formatLastUpdated, formatMoney } from "@/lib/finance/format";
import type { FinanceSnapshot, ItemView } from "@/lib/plaid/snapshot";
import { ConnectionStatusRow } from "./connection-status-row";
import { PanelShell } from "./panel-shell";
import { PlaidLinkLauncher } from "./plaid-link-launcher";
import { TransactionRow } from "./transaction-row";
import styles from "./finance.module.css";

interface BankAccountsPanelProps extends HTMLAttributes<HTMLDivElement> {
  snapshot: FinanceSnapshot;
}

// Depository widget (FR-1): combined balance headline, per-account rows, five
// most recent transactions. Mutations follow the todos-panel pattern — apply
// locally, call the action, reconcile with the returned snapshot, roll back
// with an error on failure. Connect and repair both end in syncItem(itemId),
// which returns the fresh snapshot (exchangePublicToken/repairItem only
// return the item id).
export const BankAccountsPanel = forwardRef<HTMLDivElement, BankAccountsPanelProps>(
  function BankAccountsPanel({ snapshot, className, ...rest }, ref) {
    const [bank, setBank] = useState(snapshot.bank);
    const [items, setItems] = useState(snapshot.items);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
      setBank(snapshot.bank);
      setItems(snapshot.items);
    }, [snapshot]);

    const depositoryItemIds = new Set(bank.accounts.map((account) => account.itemId));
    const connectedItems = items.filter((item) => depositoryItemIds.has(item.id));
    const statCurrency = bank.accounts[0]?.currencyCode ?? "USD";

    function reconcile(next: FinanceSnapshot) {
      setBank(next.bank);
      setItems(next.items);
    }

    async function handleConnected(itemId: string) {
      setError(null);
      setBusy(true);
      try {
        reconcile(await syncItem(itemId));
      } catch {
        setError("Sync didn't finish — data may be incomplete.");
      } finally {
        setBusy(false);
      }
    }

    async function handleRefresh() {
      setError(null);
      setBusy(true);
      try {
        reconcile(await syncNow());
      } catch {
        setError("Refresh failed — data is unchanged.");
      } finally {
        setBusy(false);
      }
    }

    function handleDisconnect(item: ItemView) {
      if (
        !window.confirm(
          `Disconnect ${item.institutionName}? Its accounts, balances, and transactions will be removed from Bradley OS.`,
        )
      ) {
        return;
      }

      const previousBank = bank;
      const previousItems = items;
      setError(null);
      setBank((current) => {
        const accounts = current.accounts.filter(
          (account) => account.itemId !== item.id,
        );
        return {
          ...current,
          accounts,
          combinedBalance: accounts.reduce(
            (sum, account) => sum + (account.currentBalance ?? 0),
            0,
          ),
        };
      });
      setItems((current) => current.filter((currentItem) => currentItem.id !== item.id));

      setBusy(true);
      void (async () => {
        try {
          await disconnectItem(item.id);
          reconcile(await syncDirtyItems());
        } catch {
          setBank(previousBank);
          setItems(previousItems);
          setError("Disconnect failed — nothing was removed.");
        } finally {
          setBusy(false);
        }
      })();
    }

    return (
      <PanelShell
        ref={ref}
        {...rest}
        className={`${styles.bankAccountsPanel}${className ? ` ${className}` : ""}`}
        glyph="$"
        eyebrow="Connected accounts"
        title="Bank Accounts"
        statValue={
          bank.accounts.length === 0 ? "—" : formatMoney(bank.combinedBalance, statCurrency)
        }
        statLabel="combined balance"
        footer={
          <div className="panel-footer-actions">
            <span>
              <span className={styles.updated}>{formatLastUpdated(bank.lastSyncAt)}</span>
              {error ? (
                <span className={styles.error}> — {error}</span>
              ) : null}
            </span>
            {bank.accounts.length > 0 ? (
              <div className={styles.footerActions}>
                <PlaidLinkLauncher
                  mode="connect"
                  label="Connect bank"
                  onConnected={handleConnected}
                />
                <button
                  type="button"
                  className={`ink-action ${styles.button}`}
                  onClick={() => void handleRefresh()}
                  disabled={busy}
                >
                  Refresh
                </button>
              </div>
            ) : null}
          </div>
        }
        rows={
          bank.accounts.length === 0 ? (
            <div className={styles.empty}>
              <p className="panel-empty">No bank accounts connected.</p>
              <PlaidLinkLauncher
                mode="connect"
                label="Connect bank"
                onConnected={handleConnected}
              />
            </div>
          ) : (
            <>
              {connectedItems.map((item) => (
                <ConnectionStatusRow
                  key={item.id}
                  institutionName={item.institutionName}
                  status={item.status}
                  lastErrorCode={item.lastErrorCode}
                  action={
                    <div className={styles.statusActions}>
                      {item.status === "needs_attention" ? (
                        <PlaidLinkLauncher
                          mode="repair"
                          itemId={item.id}
                          label="Repair"
                          onConnected={handleConnected}
                        />
                      ) : null}
                      <button
                        type="button"
                        className="ink-action"
                        onClick={() => handleDisconnect(item)}
                      >
                        Disconnect
                      </button>
                    </div>
                  }
                />
              ))}
              {bank.accounts.map((account) => (
                <div className="panel-row" key={account.id}>
                  <p className="row-main">
                    {account.name}
                    {account.mask ? (
                      <span className="row-sub"> ••{account.mask}</span>
                    ) : null}
                  </p>
                  <p className={styles.amount}>
                    {account.currentBalance === null
                      ? "—"
                      : formatMoney(account.currentBalance, account.currencyCode)}
                  </p>
                </div>
              ))}
              {bank.recent.length > 0 ? (
                <>
                  <p className={styles.sectionLabel}>Recent activity</p>
                  {bank.recent.map((transaction) => (
                    <TransactionRow key={transaction.id} transaction={transaction} />
                  ))}
                </>
              ) : null}
            </>
          )
        }
      />
    );
  },
);