import { forwardRef, type HTMLAttributes } from "react";
import Link from "next/link";

import { CALENDAR_TIME_ZONE } from "@/lib/calendar/format";
import type { InboxDigestMessage } from "@/lib/mail/inbox";
import { PanelShell } from "./panel-shell";

// Matches the time formatting already used on /inbox.
const receivedAtFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: CALENDAR_TIME_ZONE,
});

interface InboxPanelProps extends HTMLAttributes<HTMLDivElement> {
  messages: InboxDigestMessage[];
  totalUnread: number;
}

export const InboxPanel = forwardRef<HTMLDivElement, InboxPanelProps>(
  function InboxPanel({ messages, totalUnread, ...rest }, ref) {
    return (
      <PanelShell
        ref={ref}
        {...rest}
        glyph="•"
        eyebrow="Last 24h"
        title="Inbox •"
        statValue={String(totalUnread)}
        statLabel="unread"
        footer={
          <Link href="/inbox" className="ink-action">
            View all →
          </Link>
        }
        rows={
          messages.length === 0 ? (
            <p className="panel-empty">No unread mail.</p>
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
