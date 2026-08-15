import Link from "next/link";

import { CALENDAR_TIME_ZONE } from "@/lib/calendar/format";
import { getInboxDigest } from "@/lib/mail/inbox";

export const dynamic = "force-dynamic";

function formatReceivedAt(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: CALENDAR_TIME_ZONE,
  }).format(date);
}

export default async function InboxPage() {
  let messages: Awaited<ReturnType<typeof getInboxDigest>> = [];
  let error = false;

  try {
    messages = await getInboxDigest();
  } catch (cause) {
    error = true;
    console.error(
      "Unable to load inbox digest:",
      cause instanceof Error ? cause.message : "Unknown IMAP error",
    );
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10 sm:px-10">
      <header className="flex items-end justify-between border-b border-[color:var(--border)] pb-5">
        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-[color:var(--accent)]">
            Last 24 hours
          </p>
          <h1 className="mt-2 font-serif text-3xl italic">Inbox</h1>
        </div>
        <Link
          href="/"
          className="font-mono text-xs text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
        >
          Today
        </Link>
      </header>

      {error ? (
        <section className="border-b border-[color:var(--border)] py-12">
          <h2 className="font-medium">Inbox unavailable.</h2>
          <p className="mt-2 max-w-lg text-sm leading-6 text-[color:var(--muted)]">
            Bradley OS could not connect to Gmail. Check the App Password and
            try refreshing this page.
          </p>
        </section>
      ) : messages.length === 0 ? (
        <p className="py-16 text-sm text-[color:var(--muted)]">
          No unread mail. Go outside.
        </p>
      ) : (
        <ol aria-label={`${messages.length} unread messages`}>
          {messages.map((message) => (
            <li
              key={message.id}
              className="grid gap-2 border-b border-[color:var(--border)] py-5 sm:grid-cols-[minmax(10rem,14rem)_1fr_auto] sm:gap-5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{message.sender}</p>
                {message.senderAddress &&
                message.senderAddress !== message.sender ? (
                  <p className="mt-1 truncate font-mono text-[11px] text-[color:var(--muted)]">
                    {message.senderAddress}
                  </p>
                ) : null}
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-sm font-medium">
                  {message.subject}
                </h2>
                <p className="mt-1 line-clamp-2 text-sm leading-5 text-[color:var(--muted)]">
                  {message.snippet}
                </p>
              </div>
              <time
                dateTime={message.receivedAt.toISOString()}
                className="font-mono text-[11px] text-[color:var(--muted)]"
              >
                {formatReceivedAt(message.receivedAt)}
              </time>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
