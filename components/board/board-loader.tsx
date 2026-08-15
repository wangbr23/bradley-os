"use client";

import dynamic from "next/dynamic";

// react-grid-layout measures container width on mount and can't produce a
// meaningful server render, so the actual grid only ever mounts client-side.
// `ssr: false` on next/dynamic isn't allowed inside a Server Component, so
// this thin client wrapper is what app/page.tsx imports instead.
export const BoardClient = dynamic(
  () => import("./board-client").then((mod) => mod.BoardClient),
  {
    ssr: false,
    loading: () => (
      <p className="mt-10 font-mono text-xs text-[color:var(--muted)]">Loading board…</p>
    ),
  },
);
