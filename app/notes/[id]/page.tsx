import type { JSONContent } from "@tiptap/core";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";

import { NoteEditor } from "@/components/notes/note-editor";
import { db } from "@/lib/db/client";
import { notes } from "@/lib/db/schema";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function NotePage({ params }: PageProps<"/notes/[id]">) {
  const { id } = await params;
  // The diagram is deliberately not read here: the editor loads it lazily
  // when Diagram mode opens, so plain note reads pay nothing for canvas data.
  const [note, folderList] = await Promise.all([
    db.query.notes.findFirst({ where: eq(notes.id, id) }),
    db.query.folders.findMany({ orderBy: (folder, { asc }) => [asc(folder.name)] }),
  ]);
  if (!note) notFound();

  return (
    <main className={styles.page}>
      <nav className={styles.homeNav} aria-label="Home navigation">
        <Link href="/" className="ink-action">
          ← Home
        </Link>
      </nav>
      <header className={styles.header}>
        <Link href="/notes" className="ink-action">
          All notes
        </Link>
      </header>
      <NoteEditor
        id={note.id}
        initialTitle={note.title}
        initialBody={note.bodyJson as JSONContent}
        initialFolderId={note.folderId}
        folders={folderList.map(({ id: folderId, name }) => ({ id: folderId, name }))}
      />
    </main>
  );
}
