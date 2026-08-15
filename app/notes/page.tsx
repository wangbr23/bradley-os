import { desc } from "drizzle-orm";
import Link from "next/link";

import { createNote } from "@/app/notes/actions";
import { CALENDAR_TIME_ZONE } from "@/lib/calendar/format";
import { db } from "@/lib/db/client";
import { notes } from "@/lib/db/schema";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

function formatUpdatedAt(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: CALENDAR_TIME_ZONE,
    month: "short",
    day: "numeric",
    year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  }).format(date);
}

export default async function NotesPage() {
  const noteList = await db
    .select({ id: notes.id, title: notes.title, updatedAt: notes.updatedAt })
    .from(notes)
    .orderBy(desc(notes.updatedAt));

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>
            {noteList.length} {noteList.length === 1 ? "note" : "notes"}
          </p>
          <h1 className={styles.title}>
            Notes
          </h1>
        </div>
        <div className={styles.actions}>
          <form action={createNote}>
            <button type="submit" className="ink-action">
              New note
            </button>
          </form>
          <Link href="/" className="ink-action">
            ← Home
          </Link>
        </div>
      </header>

      {noteList.length === 0 ? (
        <section className={styles.empty}>
          <p className={styles.emptyCopy}>
            Nothing written down. Suspicious.
          </p>
          <form action={createNote} className={styles.emptyForm}>
            <button type="submit" className="ink-action">
              Write the first note
            </button>
          </form>
        </section>
      ) : (
        <ol>
          {noteList.map((note) => (
            <li key={note.id} className={styles.note}>
              <Link
                href={`/notes/${note.id}`}
                className={styles.noteLink}
              >
                <span className={styles.noteTitle}>
                  {note.title}
                </span>
                <time className={styles.updated}>
                  Updated {formatUpdatedAt(note.updatedAt)}
                </time>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
