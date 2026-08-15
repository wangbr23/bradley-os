import type { JSONContent } from "@tiptap/core";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";

import { NoteEditor } from "@/components/notes/note-editor";
import { db } from "@/lib/db/client";
import { diagrams, notes } from "@/lib/db/schema";
import type { DiagramScene } from "@/lib/diagrams/types";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function NotePage({ params }: PageProps<"/notes/[id]">) {
  const { id } = await params;
  const note = await db.query.notes.findFirst({ where: eq(notes.id, id) });
  if (!note) notFound();
  let diagram = await db.query.diagrams.findFirst({
    where: eq(diagrams.noteId, id),
  });
  if (!diagram) {
    const now = new Date();
    const diagramId = crypto.randomUUID();
    await db.insert(diagrams).values({
      id: diagramId,
      noteId: id,
      title: `${note.title} canvas`,
      sceneJson: { elements: [], appState: {}, files: {} },
      createdAt: now,
      updatedAt: now,
    });
    diagram = await db.query.diagrams.findFirst({
      where: eq(diagrams.id, diagramId),
    });
  }
  if (!diagram) throw new Error("Unable to create note canvas");

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/notes" className="ink-action">
          All notes
        </Link>
        <Link href="/" className="ink-action">
          Today
        </Link>
      </header>
      <NoteEditor
        id={note.id}
        initialTitle={note.title}
        initialBody={note.bodyJson as JSONContent}
        initialDiagram={{ id: diagram.id, scene: diagram.sceneJson as DiagramScene }}
      />
    </main>
  );
}
