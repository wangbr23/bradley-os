"use client";

import dynamic from "next/dynamic";
import styles from "./board.module.css";

// react-grid-layout measures container width on mount and can't produce a
// meaningful server render, so the actual grid only ever mounts client-side.
// `ssr: false` on next/dynamic isn't allowed inside a Server Component, so
// this thin client wrapper is what app/page.tsx imports instead.
export const BoardClient = dynamic(
  () => import("./board-client").then((mod) => mod.BoardClient),
  {
    ssr: false,
    loading: () => (
      <p className={styles.loading}>Loading board…</p>
    ),
  },
);
