import { asc, desc, eq } from "drizzle-orm";
import type { Layout } from "react-grid-layout";

import { signOut } from "@/auth";
import { getHomeLayout } from "@/app/actions/board-layout";
import { BoardClient } from "@/components/board/board-loader";
import { TimezoneToggle } from "@/components/timezone-toggle";
import { getCurrentCalendarWeekRange } from "@/lib/calendar/google";
import { db } from "@/lib/db/client";
import { folders, notes, todos } from "@/lib/db/schema";
import { getFinanceSnapshot } from "@/lib/plaid/snapshot";
import { getServerTimeZone } from "@/lib/timezone-server";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function Home() {
  const tz = await getServerTimeZone();
  const range = getCurrentCalendarWeekRange();
  const [noteList, todoList, persistedLayout, financeSnapshot] = await Promise.all([
    db
      .select({ id: notes.id, title: notes.title, updatedAt: notes.updatedAt, folderName: folders.name })
      .from(notes)
      .leftJoin(folders, eq(notes.folderId, folders.id))
      .orderBy(desc(notes.updatedAt)),
    db
      .select({ id: todos.id, text: todos.text, done: todos.done })
      .from(todos)
      .orderBy(asc(todos.done), desc(todos.createdAt)),
    getHomeLayout(),
    getFinanceSnapshot(),
  ]);

  const initialLayout = Array.isArray(persistedLayout) ? (persistedLayout as Layout[]) : null;

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <header className={styles.masthead}>
          <div className={styles.mastheadLeft}>
            <h1 className={styles.mastheadTitle}>Bradley-OS</h1>
            <span className={styles.mastheadSep}>·</span>
            <time className={styles.mastheadDate} dateTime={new Date().toISOString().slice(0, 10)}>
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: tz })}
            </time>
          </div>
          <div className={styles.mastheadRight}>
            <TimezoneToggle current={tz} />
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/sign-in" });
              }}
            >
              <button type="submit" className={styles.mastheadSignOut}>
                Sign out
              </button>
            </form>
          </div>
        </header>

        <div className={styles.board}>
          <BoardClient
            initialLayout={initialLayout}
            today={new Date()}
            calendarWeekStart={range.start}
            calendarWeekEnd={range.end}
            recentNotes={noteList.slice(0, 6)}
            totalNotes={noteList.length}
            todos={todoList}
            financeSnapshot={financeSnapshot}
            now={new Date()}
            timeZone={tz}
          />
        </div>
      </div>
    </div>
  );
}
