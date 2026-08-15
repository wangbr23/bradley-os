"use server";

import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { todos } from "@/lib/db/schema";
import { requireOwner } from "@/lib/auth/require-owner";

export async function addTodo(formData: FormData) {
  await requireOwner();
  const text = String(formData.get("text") ?? "").trim();
  if (!text || text.length > 500) return;

  const todo = {
    id: crypto.randomUUID(),
    text,
    done: false,
    createdAt: new Date(),
  };
  await db.insert(todos).values(todo);
  return { id: todo.id, text: todo.text, done: todo.done };
}

export async function setTodoDone(id: string, done: boolean) {
  await requireOwner();
  await db
    .update(todos)
    .set({ done, completedAt: done ? new Date() : null })
    .where(eq(todos.id, id));
}

export async function deleteTodo(id: string) {
  await requireOwner();
  await db.delete(todos).where(eq(todos.id, id));
}
