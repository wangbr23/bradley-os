import { asc, desc, or, sql } from "drizzle-orm";
import Link from "next/link";

import { createNote } from "@/app/notes/actions";
import { FolderSidebar } from "@/components/notes/folder-sidebar";
import { CALENDAR_TIME_ZONE } from "@/lib/calendar/format";
import { db } from "@/lib/db/client";
import { folders, notes } from "@/lib/db/schema";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

function formatUpdatedAt(date: Date) {
  return new Intl.DateTimeFormat("en-US", { timeZone: CALENDAR_TIME_ZONE, month: "short", day: "numeric", year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric" }).format(date);
}

function escapeLike(term: string) {
  return term.replace(/[\\%_]/g, (char) => `\\${char}`);
}

// SQLite LIKE is case-insensitive for ASCII by default; matching the raw
// body_json text also catches words inside the serialized Tiptap document.
function searchClause(term: string) {
  const pattern = `%${escapeLike(term)}%`;
  return or(
    sql`${notes.title} LIKE ${pattern} ESCAPE '\\'`,
    sql`${notes.bodyJson} LIKE ${pattern} ESCAPE '\\'`,
  );
}

export default async function NotesPage({ searchParams }: PageProps<"/notes">) {
  const { folder: requestedFolder, q: rawQuery } = await searchParams;
  const term = typeof rawQuery === "string" ? rawQuery.trim() : "";
  const searching = term.length > 0;

  const [noteList, folderList] = await Promise.all([
    db.select({ id: notes.id, title: notes.title, folderId: notes.folderId, updatedAt: notes.updatedAt }).from(notes).orderBy(desc(notes.updatedAt)),
    db.select({ id: folders.id, name: folders.name }).from(folders).orderBy(asc(folders.name)),
  ]);
  const results = searching
    ? await db.select({ id: notes.id, title: notes.title, folderId: notes.folderId, updatedAt: notes.updatedAt }).from(notes).where(searchClause(term)).orderBy(desc(notes.updatedAt))
    : [];
  const rawFolder = typeof requestedFolder === "string" ? requestedFolder : "all";
  const selected = !searching && (rawFolder === "unfiled" || folderList.some((folder) => folder.id === rawFolder)) ? rawFolder : "all";
  const selectedFolder = folderList.find((folder) => folder.id === selected);
  const visibleNotes = searching ? results : selected === "all" ? noteList : selected === "unfiled" ? noteList.filter((note) => !note.folderId) : noteList.filter((note) => note.folderId === selected);
  const folderNameById = new Map(folderList.map((folder) => [folder.id, folder.name]));
  const foldersWithCounts = folderList.map((folder) => ({ ...folder, count: noteList.filter((note) => note.folderId === folder.id).length }));
  const title = searching ? `Search: “${term}”` : selected === "all" ? "All Notes" : selected === "unfiled" ? "Unfiled" : selectedFolder?.name ?? "All Notes";

  return <main className={styles.page}>
    <nav className={styles.homeNav} aria-label="Home navigation"><Link href="/" className="ink-action">← Home</Link></nav>
    <div className={styles.layout}>
      <FolderSidebar folders={foldersWithCounts} notes={noteList.map(({ id, title: noteTitle, folderId }) => ({ id, title: noteTitle, folderId }))} selected={selected} totalCount={noteList.length} />
      <section className={styles.content}>
        <header className={styles.header}>
          <div><p className={styles.eyebrow}>{searching ? `${visibleNotes.length} ${visibleNotes.length === 1 ? "match" : "matches"} for “${term}”` : `${visibleNotes.length} ${visibleNotes.length === 1 ? "note" : "notes"}`}</p><h1 className={styles.title}>{title}</h1></div>
          <div className={styles.actions}>
            <form action="/notes" method="get" role="search" className={styles.searchForm}>
              <input type="search" name="q" defaultValue={term} placeholder="Search notes…" aria-label="Search notes" className={styles.searchInput} />
            </form>
            <form action={createNote}>{selectedFolder ? <input type="hidden" name="folderId" value={selectedFolder.id} /> : null}<button type="submit" className="ink-action">New note</button></form>
          </div>
        </header>
        {visibleNotes.length === 0 ? (searching ? <section className={styles.empty}><p className={styles.emptyCopy}>No notes match “{term}”.</p></section> :
          <section className={styles.empty}><p className={styles.emptyCopy}>Nothing written down. Suspicious.</p><form action={createNote} className={styles.emptyForm}>{selectedFolder ? <input type="hidden" name="folderId" value={selectedFolder.id} /> : null}<button type="submit" className="ink-action">Write the first note</button></form></section>) :
          <ol>{visibleNotes.map((note) => <li key={note.id} className={styles.note}><Link href={`/notes/${note.id}`} className={styles.noteLink}><span><span className={styles.noteTitle}>{note.title}</span><span className={styles.folderLabel}>{note.folderId ? folderNameById.get(note.folderId) : "Unfiled"}</span></span><time className={styles.updated}>Updated {formatUpdatedAt(note.updatedAt)}</time></Link></li>)}</ol>}
      </section>
    </div>
  </main>;
}
