import { asc, desc } from "drizzle-orm";
import type { Layout } from "react-grid-layout";

import { auth, signOut } from "@/auth";
import { getHomeLayout } from "@/app/actions/board-layout";
import { BoardClient } from "@/components/board/board-loader";
import {
  getCurrentCalendarWeekRange,
  getPrimaryCalendarEvents,
  type CalendarEvent,
} from "@/lib/calendar/google";
import { db } from "@/lib/db/client";
import { notes, todos } from "@/lib/db/schema";
import { getInboxDigest, type InboxDigestMessage } from "@/lib/mail/inbox";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await auth();
  const range = getCurrentCalendarWeekRange();
  const accessToken = session?.googleAccessToken;
  const calendarEventsPromise =
    accessToken && !session?.googleTokenError
      ? getPrimaryCalendarEvents(accessToken, range).catch(() => [] as CalendarEvent[])
      : Promise.resolve([] as CalendarEvent[]);

  const [calendarEvents, inboxMessages, noteList, todoList, persistedLayout] = await Promise.all([
    calendarEventsPromise,
    getInboxDigest().catch(() => [] as InboxDigestMessage[]),
    db
      .select({ id: notes.id, title: notes.title, updatedAt: notes.updatedAt })
      .from(notes)
      .orderBy(desc(notes.updatedAt)),
    db
      .select({ id: todos.id, text: todos.text, done: todos.done })
      .from(todos)
      .orderBy(asc(todos.done), desc(todos.createdAt)),
    getHomeLayout(),
  ]);

  const initialLayout = Array.isArray(persistedLayout) ? (persistedLayout as Layout[]) : null;

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <div className={styles.intro}>
          <div className="ledger-rule" />
          <div className={styles.statusRow}>
            <p className={styles.status}>
              ○ Signed in
            </p>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/sign-in" });
              }}
            >
              <button type="submit" className="ink-action">
                ✕ Sign out
              </button>
            </form>
          </div>
          <h1 className={styles.title}>bradley-os</h1>
          <p className={styles.welcome}>
            – Welcome, {session?.user?.name ?? session?.user?.email}.
          </p>
        </div>

        <div className={styles.board}>
          <BoardClient
            initialLayout={initialLayout}
            today={new Date()}
            calendarEvents={calendarEvents}
            calendarWeekStart={range.start}
            inboxMessages={inboxMessages}
            totalUnread={inboxMessages.length}
            recentNotes={noteList.slice(0, 3)}
            totalNotes={noteList.length}
            todos={todoList}
            now={new Date()}
          />
        </div>
      </div>
    </div>
  );
}
