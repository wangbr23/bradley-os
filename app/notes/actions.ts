"use server";

import type { JSONContent } from "@tiptap/core";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/lib/db/client";
import { diagrams, notes } from "@/lib/db/schema";
import { requireOwner } from "@/lib/auth/require-owner";
import type { DiagramScene } from "@/lib/diagrams/types";

export async function createNote() {
  await requireOwner();

  const id = crypto.randomUUID();
  const now = new Date();
  await db.insert(notes).values({
    id,
    title: "Untitled note",
    bodyJson: { type: "doc", content: [{ type: "paragraph" }] },
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(diagrams).values({
    id: crypto.randomUUID(),
    title: "Untitled note canvas",
    sceneJson: { elements: [], appState: {}, files: {} },
    noteId: id,
    createdAt: now,
    updatedAt: now,
  });

  revalidatePath("/notes");
  redirect(`/notes/${id}`);
}

export async function saveNoteTitle(id: string, title: string) {
  await requireOwner();
  await db
    .update(notes)
    .set({ title: title.trim() || "Untitled note", updatedAt: new Date() })
    .where(eq(notes.id, id));
  revalidatePath("/notes");
  revalidatePath(`/notes/${id}`);
}

export async function saveNote(id: string, title: string, body: JSONContent) {
  await requireOwner();

  const cleanTitle = title.trim() || "Untitled note";
  if (!body || body.type !== "doc") throw new Error("Invalid note body");

  await db
    .update(notes)
    .set({ title: cleanTitle, bodyJson: body, updatedAt: new Date() })
    .where(eq(notes.id, id));

  revalidatePath("/notes");
  revalidatePath(`/notes/${id}`);
}

export async function deleteNote(id: string) {
  await requireOwner();
  await db.delete(diagrams).where(eq(diagrams.noteId, id));
  await db.delete(notes).where(eq(notes.id, id));
  revalidatePath("/notes");
  redirect("/notes");
}

export async function createNoteDiagram(noteId: string) {
  await requireOwner();
  const note = await db.query.notes.findFirst({ where: eq(notes.id, noteId) });
  if (!note) throw new Error("Note not found");

  const existing = await db.query.diagrams.findFirst({
    where: eq(diagrams.noteId, noteId),
  });
  if (existing) return { id: existing.id, scene: existing.sceneJson as DiagramScene };

  const id = crypto.randomUUID();
  const now = new Date();
  const scene: DiagramScene = { elements: [], appState: {}, files: {} };
  await db.insert(diagrams).values({
    id,
    noteId,
    title: `${note.title} diagram`,
    sceneJson: scene,
    createdAt: now,
    updatedAt: now,
  });
  return { id, scene };
}

export async function saveNoteDiagram(
  id: string,
  noteId: string,
  scene: DiagramScene,
) {
  await requireOwner();
  if (!Array.isArray(scene.elements) || !scene.appState || !scene.files) {
    throw new Error("Invalid diagram scene");
  }
  await db
    .update(diagrams)
    .set({ sceneJson: scene, updatedAt: new Date() })
    .where(and(eq(diagrams.id, id), eq(diagrams.noteId, noteId)));
}

export async function deleteNoteDiagram(id: string, noteId: string) {
  await requireOwner();
  await db
    .delete(diagrams)
    .where(and(eq(diagrams.id, id), eq(diagrams.noteId, noteId)));
}
