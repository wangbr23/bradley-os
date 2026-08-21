import { asc, desc, eq } from "drizzle-orm";
import type { Layout } from "react-grid-layout";

import { signOut } from "@/auth";
import { getHomeLayout } from "@/app/actions/board-layout";
import { BoardClient } from "@/components/board/board-loader";
import { getCurrentCalendarWeekRange } from "@/lib/calendar/google";
import { db } from "@/lib/db/client";
import { folders, notes, todos } from "@/lib/db/schema";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function Home() {
  const range = getCurrentCalendarWeekRange();
  const [noteList, todoList, persistedLayout] = await Promise.all([
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
        </div>

        <div className={styles.board}>
          <BoardClient
            initialLayout={initialLayout}
            today={new Date()}
            calendarWeekStart={range.start}
            calendarWeekEnd={range.end}
            recentNotes={noteList.slice(0, 6)}
            totalNotes={noteList.length}
            todos={todoList}
            now={new Date()}
          />
        </div>
      </div>
    </div>
  );
}
