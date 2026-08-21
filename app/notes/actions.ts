"use server";

import type { JSONContent } from "@tiptap/core";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/lib/db/client";
import { diagrams, folders, notes } from "@/lib/db/schema";
import { requireOwner } from "@/lib/auth/require-owner";
import type { DiagramScene } from "@/lib/diagrams/types";

export async function createNote(formData?: FormData) {
  await requireOwner();

  const requestedFolderId = formData?.get("folderId");
  const folderId = typeof requestedFolderId === "string" && requestedFolderId ? requestedFolderId : null;
  if (folderId) {
    const folder = await db.query.folders.findFirst({ where: eq(folders.id, folderId) });
    if (!folder) throw new Error("Folder not found");
  }

  const id = crypto.randomUUID();
  const now = new Date();
  await db.insert(notes).values({
    id,
    title: "Untitled note",
    bodyJson: { type: "doc", content: [{ type: "paragraph" }] },
    folderId,
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

function cleanFolderName(name: string) {
  const cleanName = name.trim();
  if (!cleanName || cleanName.length > 80) {
    throw new Error("Folder names must be between 1 and 80 characters");
  }
  return cleanName;
}

async function assertUniqueFolderName(name: string, exceptId?: string) {
  const folderList = await db.select({ id: folders.id, name: folders.name }).from(folders);
  if (folderList.some((folder) => folder.id !== exceptId && folder.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
    throw new Error("A folder with that name already exists");
  }
}

export async function createFolder(name: string) {
  await requireOwner();
  const cleanName = cleanFolderName(name);
  await assertUniqueFolderName(cleanName);
  const id = crypto.randomUUID();
  const now = new Date();
  await db.insert(folders).values({ id, name: cleanName, createdAt: now, updatedAt: now });
  revalidatePath("/notes");
  return { id, name: cleanName };
}

export async function renameFolder(id: string, name: string) {
  await requireOwner();
  const cleanName = cleanFolderName(name);
  await assertUniqueFolderName(cleanName, id);
  const folder = await db.query.folders.findFirst({ where: eq(folders.id, id) });
  if (!folder) throw new Error("Folder not found");
  await db.update(folders).set({ name: cleanName, updatedAt: new Date() }).where(eq(folders.id, id));
  revalidatePath("/");
  revalidatePath("/notes");
  return { id, name: cleanName };
}

export async function deleteFolder(id: string) {
  await requireOwner();
  await db.delete(folders).where(eq(folders.id, id));
  revalidatePath("/");
  revalidatePath("/notes");
}

export async function moveNoteToFolder(noteId: string, folderId: string | null) {
  await requireOwner();
  if (folderId) {
    const folder = await db.query.folders.findFirst({ where: eq(folders.id, folderId) });
    if (!folder) throw new Error("Folder not found");
  }
  await db.update(notes).set({ folderId, updatedAt: new Date() }).where(eq(notes.id, noteId));
  revalidatePath("/");
  revalidatePath("/notes");
  revalidatePath(`/notes/${noteId}`);
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

export async function deleteNoteFromBoard(id: string) {
  await requireOwner();
  await db.delete(diagrams).where(eq(diagrams.noteId, id));
  await db.delete(notes).where(eq(notes.id, id));
  revalidatePath("/");
  revalidatePath("/notes");
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
