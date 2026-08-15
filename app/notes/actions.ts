"use server";

import type { JSONContent } from "@tiptap/core";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { db } from "@/lib/db/client";
import { notes } from "@/lib/db/schema";

async function requireOwner() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
}

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

  revalidatePath("/notes");
  redirect(`/notes/${id}`);
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
  await db.delete(notes).where(eq(notes.id, id));
  revalidatePath("/notes");
  redirect("/notes");
}
