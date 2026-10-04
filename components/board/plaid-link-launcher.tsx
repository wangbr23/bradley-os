"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

import {
  createLinkToken,
  exchangePublicToken,
  repairItem,
} from "@/app/actions/finance";
import styles from "./plaid-link-launcher.module.css";

const LinkOpener = dynamic(
  () => import("./plaid-link-opener").then((module) => module.LinkOpener),
  { ssr: false },
);

type PlaidLinkLauncherProps =
  | { mode: "connect"; label: string; onConnected: (itemId: string) => void }
  | {
      mode: "repair";
      itemId: string;
      label: string;
      onConnected: (itemId: string) => void;
    };

// Reused by both finance panels (LLD §6.9): mounts a button, fetches a fresh
// link token per click (tokens expire ~30 min, public tokens are single-use),
// opens Plaid Link through the client-only opener, and exchanges the public
// token once the user finishes. Any failure leaves the button idle so the
// user simply re-clicks.
export function PlaidLinkLauncher(props: PlaidLinkLauncherProps) {
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConnect() {
    setError(null);
    setBusy(true);
    try {
      const linkToken =
        props.mode === "repair"
          ? await repairItem(props.itemId)
          : await createLinkToken();
      setToken(linkToken);
    } catch {
      setError("Couldn't start Plaid — try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSuccess(publicToken: string | null) {
    if (!publicToken) {
      setError("Plaid returned no token — try again.");
      setToken(null);
      return;
    }
    setError(null);
    setToken(null);
    setBusy(true);
    try {
      const { itemId } = await exchangePublicToken(publicToken);
      props.onConnected(itemId);
    } catch {
      setError("Connection didn't complete — try again.");
    } finally {
      setBusy(false);
    }
  }

  function handleExit() {
    setToken(null);
  }

  function handleScriptError() {
    setToken(null);
    setError("Plaid's window couldn't load — try again.");
  }

  return (
    <>
      <button
        type="button"
        className={`ink-action ${styles.button}`}
        onClick={handleConnect}
        disabled={busy || token !== null}
      >
        {busy ? "Working…" : props.label}
      </button>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      {token ? (
        <LinkOpener
          token={token}
          onSuccess={handleSuccess}
          onExit={handleExit}
          onScriptError={handleScriptError}
        />
      ) : null}
    </>
  );
}