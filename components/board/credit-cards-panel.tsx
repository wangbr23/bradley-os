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

interface CreditCardsPanelProps extends HTMLAttributes<HTMLDivElement> {
  snapshot: FinanceSnapshot;
}

// Credit widget (FR-2): one tab per connected card, each showing the balance
// owed and its five most recent transactions. Same mutation pattern as the
// bank panel — optimistic apply, action call, snapshot reconcile, rollback.
export const CreditCardsPanel = forwardRef<HTMLDivElement, CreditCardsPanelProps>(
  function CreditCardsPanel({ snapshot, className, ...rest }, ref) {
    const [cards, setCards] = useState(snapshot.cards);
    const [items, setItems] = useState(snapshot.items);
    const [selectedId, setSelectedId] = useState<string | null>(
      snapshot.cards.accounts[0]?.id ?? null,
    );
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
      setCards(snapshot.cards);
      setItems(snapshot.items);
    }, [snapshot]);

    // Falls back to the first card when the selected one is gone (removal or
    // a fresh snapshot without it), so the selection never dangles.
    const selectedAccount =
      cards.accounts.find((account) => account.id === selectedId) ??
      cards.accounts[0] ??
      null;
    const selectedTransactions =
      cards.perAccount.find((entry) => entry.accountId === selectedAccount?.id)
        ?.transactions ?? [];
    const creditItemIds = new Set(cards.accounts.map((account) => account.itemId));
    const connectedItems = items.filter((item) => creditItemIds.has(item.id));

    function reconcile(next: FinanceSnapshot) {
      setCards(next.cards);
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

      const previousCards = cards;
      const previousItems = items;
      setError(null);
      setCards((current) => {
        const remaining = current.accounts.filter(
          (account) => account.itemId !== item.id,
        );
        const remainingIds = new Set(remaining.map((account) => account.id));
        return {
          ...current,
          accounts: remaining,
          perAccount: current.perAccount.filter((entry) =>
            remainingIds.has(entry.accountId),
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
          setCards(previousCards);
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
        className={`${styles.creditCardsPanel}${className ? ` ${className}` : ""}`}
        glyph="¢"
        eyebrow="Card balances"
        title="Credit Cards"
        statValue={
          selectedAccount?.currentBalance == null
            ? "—"
            : formatMoney(selectedAccount.currentBalance, selectedAccount.currencyCode)
        }
        statLabel="owed"
        afterStat={
          cards.accounts.length > 0 ? (
            <div className={styles.tabs} role="tablist" aria-label="Credit cards">
              {cards.accounts.map((account) => (
                <button
                  key={account.id}
                  type="button"
                  role="tab"
                  aria-selected={account.id === selectedAccount?.id}
                  className={styles.tab}
                  data-active={account.id === selectedAccount?.id}
                  onClick={() => setSelectedId(account.id)}
                >
                  {account.name}
                  {account.mask ? ` ••${account.mask}` : ""}
                </button>
              ))}
            </div>
          ) : null
        }
        footer={
          <div className="panel-footer-actions">
            <span>
              <span className={styles.updated}>{formatLastUpdated(cards.lastSyncAt)}</span>
              {error ? (
                <span className={styles.error}> — {error}</span>
              ) : null}
            </span>
            {cards.accounts.length > 0 ? (
              <button
                type="button"
                className={`ink-action ${styles.button}`}
                onClick={() => void handleRefresh()}
                disabled={busy}
              >
                Refresh
              </button>
            ) : null}
          </div>
        }
        rows={
          cards.accounts.length === 0 ? (
            <div className={styles.empty}>
              <p className="panel-empty">No credit cards connected.</p>
              <PlaidLinkLauncher
                mode="connect"
                label="Connect card"
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
              {selectedTransactions.length > 0 ? (
                <>
                  <p className={styles.sectionLabel}>Recent activity</p>
                  {selectedTransactions.map((transaction) => (
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