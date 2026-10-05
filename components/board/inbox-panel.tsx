"use client";

import { forwardRef, type HTMLAttributes, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { getInboxData } from "@/app/actions/inbox";
import type { InboxDigestMessage } from "@/lib/mail/inbox";
import type { AppTimeZone } from "@/lib/timezone";
import { PanelShell } from "./panel-shell";
import { cachedInbox, setCachedInbox } from "./dashboard-cache";

interface InboxPanelProps extends HTMLAttributes<HTMLDivElement> {
  timeZone: AppTimeZone;
}

export const InboxPanel = forwardRef<HTMLDivElement, InboxPanelProps>(
  function InboxPanel({ className, timeZone, ...rest }, ref) {
    const receivedAtFormatter = useMemo(
      () => new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone }),
      [timeZone],
    );
    const [messages, setMessages] = useState<InboxDigestMessage[]>(() => cachedInbox ?? []);
    const [loading, setLoading] = useState(cachedInbox === null);
    const [error, setError] = useState(false);

    const load = useCallback(async (force = false) => {
      setLoading(true);
      setError(false);
      try {
        const snapshot = await getInboxData(force);
        setMessages(snapshot.messages);
        setCachedInbox(snapshot.messages);
        if (snapshot.stale && !force) {
          const fresh = await getInboxData(true);
          setMessages(fresh.messages);
          setCachedInbox(fresh.messages);
        }
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }, []);

    useEffect(() => {
      void load(false);
    }, [load]);

    return (
      <PanelShell
        ref={ref}
        {...rest}
        className={`inbox-panel${className ? ` ${className}` : ""}`}
        glyph="•"
        eyebrow="Last 24h"
        title="Inbox •"
        statValue={loading && messages.length === 0 ? "…" : String(messages.length)}
        statLabel="unread"
        footer={
          <div className="panel-footer-actions">
            <Link href="/inbox" className="ink-action">View all →</Link>
            <button type="button" className="ink-action" onClick={() => void load(true)}>Refresh</button>
          </div>
        }
        rows={
          loading && messages.length === 0 ? (
            <p className="panel-empty">Loading inbox…</p>
          ) : error && messages.length === 0 ? (
            <p className="panel-empty">Inbox unavailable.</p>
          ) : messages.length === 0 ? (
            <p className="panel-empty">No unread mail. Go outside.</p>
          ) : (
            messages.map((message) => (
              <div className="panel-row" key={message.id}>
                <p className="row-main">
                  <span className="glyph">•</span>
                  {message.sender}
                  <span className="row-sub"> — {message.subject}</span>
                </p>
                <p className="row-time">{receivedAtFormatter.format(message.receivedAt)}</p>
              </div>
            ))
          )
        }
      />
    );
  },
);
