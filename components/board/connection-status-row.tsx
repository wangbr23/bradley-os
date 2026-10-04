"use client";

import type { ReactNode } from "react";

import styles from "./finance.module.css";

interface ConnectionStatusRowProps {
  institutionName: string;
  status: "healthy" | "needs_attention";
  lastErrorCode: string | null;
  action?: ReactNode;
}

// One line per connected institution, labeling the connection state
// (FR-3.3/FR-4.5). The repair affordance itself lives in the panels next to
// this row; the status dot carries the at-a-glance signal.
export function ConnectionStatusRow({
  institutionName,
  status,
  lastErrorCode,
  action,
}: ConnectionStatusRowProps) {
  const healthy = status === "healthy";

  return (
    <div className="panel-row">
      <p className="row-main">
        <span className={styles.statusDot} data-healthy={healthy}>
          •
        </span>
        {institutionName}
        <span className="row-sub">
          {" "}
          —{" "}
          {healthy
            ? "Connected"
            : `Needs attention${lastErrorCode ? ` (${lastErrorCode})` : ""}`}
        </span>
      </p>
      {action ? <div className={styles.statusActions}>{action}</div> : null}
    </div>
  );
}