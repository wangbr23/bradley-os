import { desc } from "drizzle-orm";
import Link from "next/link";

import { createNote } from "@/app/notes/actions";
import { db } from "@/lib/db/client";
import { notes } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

function formatUpdatedAt(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
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
    <main className="mx-auto w-full max-w-4xl px-6 py-10 sm:px-10">
      <header className="flex items-end justify-between border-b border-[color:var(--border)] pb-5">
        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-[color:var(--accent)]">
            {noteList.length} {noteList.length === 1 ? "note" : "notes"}
          </p>
          <h1 className="mt-2 font-mono text-3xl font-bold tracking-tight">
            Notes
          </h1>
        </div>
        <div className="flex items-center gap-6">
          <form action={createNote}>
            <button type="submit" className="ink-action">
              New note
            </button>
          </form>
          <Link href="/" className="ink-action">
            Today
          </Link>
        </div>
      </header>

      {noteList.length === 0 ? (
        <section className="py-16">
          <p className="text-sm text-[color:var(--muted)]">
            Nothing written down. Suspicious.
          </p>
          <form action={createNote} className="mt-6">
            <button type="submit" className="ink-action">
              Write the first note
            </button>
          </form>
        </section>
      ) : (
        <ol>
          {noteList.map((note) => (
            <li key={note.id} className="border-b border-[color:var(--border)]">
              <Link
                href={`/notes/${note.id}`}
                className="grid gap-2 py-5 sm:grid-cols-[1fr_auto] sm:items-baseline sm:gap-8"
              >
                <span className="text-lg font-semibold decoration-[color:var(--accent)] decoration-2 underline-offset-4 hover:underline">
                  {note.title}
                </span>
                <time className="font-mono text-[11px] uppercase tracking-wide text-[color:var(--muted)]">
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
