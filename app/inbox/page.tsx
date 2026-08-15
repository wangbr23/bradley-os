import Link from "next/link";

import { CALENDAR_TIME_ZONE } from "@/lib/calendar/format";
import { getInboxDigest } from "@/lib/mail/inbox";
import styles from "./page.module.css";

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
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>
            Last 24 hours
          </p>
          <h1 className={styles.title}>Inbox</h1>
        </div>
        <Link
          href="/"
          className="ink-action"
        >
          ← Home
        </Link>
      </header>

      {error ? (
        <section className={styles.error}>
          <h2 className={styles.errorTitle}>Inbox unavailable.</h2>
          <p className={styles.errorCopy}>
            Bradley OS could not connect to Gmail. Check the App Password and
            try refreshing this page.
          </p>
        </section>
      ) : messages.length === 0 ? (
        <p className={styles.empty}>
          No unread mail. Go outside.
        </p>
      ) : (
        <ol aria-label={`${messages.length} unread messages`}>
          {messages.map((message) => (
            <li
              key={message.id}
              className={styles.message}
            >
              <div className={styles.messageColumn}>
                <p className={styles.primary}>{message.sender}</p>
                {message.senderAddress &&
                message.senderAddress !== message.sender ? (
                  <p className={styles.address}>
                    {message.senderAddress}
                  </p>
                ) : null}
              </div>
              <div className={styles.messageColumn}>
                <h2 className={styles.primary}>
                  {message.subject}
                </h2>
                <p className={styles.snippet}>
                  {message.snippet}
                </p>
              </div>
              <time
                dateTime={message.receivedAt.toISOString()}
                className={styles.time}
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
