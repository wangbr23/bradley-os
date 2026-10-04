"use client";

import { useEffect } from "react";
import { usePlaidLink } from "react-plaid-link";
import type { PlaidLinkOnExit, PlaidLinkOnSuccess } from "react-plaid-link";

interface LinkOpenerProps {
  token: string;
  onSuccess: PlaidLinkOnSuccess;
  onExit: PlaidLinkOnExit;
  onScriptError: (error: ErrorEvent) => void;
}

// Client-only half of the launcher (next/dynamic, ssr: false — same pattern as
// Excalidraw). Mounted only while a fresh link token exists; unmounting
// destroys the Plaid Link UI. The token never changes while mounted, so the
// hook's create-on-token-change behavior is irrelevant here.
export function LinkOpener({ token, onSuccess, onExit, onScriptError }: LinkOpenerProps) {
  const { open, ready, error } = usePlaidLink({
    token,
    onSuccess,
    onExit,
    // Required for Production OAuth institutions: Link needs the current URL
    // to resume after the bank's redirect back (LLD §6.10, deployment-boundary
    // TODO). Sandbox non-OAuth banks ignore it.
    receivedRedirectUri: window.location.href,
  });

  useEffect(() => {
    if (ready) open();
  }, [ready, open]);

  useEffect(() => {
    if (error) onScriptError(error);
  }, [error, onScriptError]);

  return null;
}