import { desc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { requireOwner } from "@/lib/auth/require-owner";
import { db } from "@/lib/db/client";
import { searchClause } from "@/lib/db/note-search";
import { folders, notes } from "@/lib/db/schema";

export async function GET(request: NextRequest) {
  await requireOwner();
  const term = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!term) return NextResponse.json({ notes: [] });

  const [matches, folderList] = await Promise.all([
    db
      .select({ id: notes.id, title: notes.title, folderId: notes.folderId })
      .from(notes)
      .where(searchClause(term))
      .orderBy(desc(notes.updatedAt))
      .limit(8),
    db.select({ id: folders.id, name: folders.name }).from(folders),
  ]);
  const folderNameById = new Map(folderList.map((folder) => [folder.id, folder.name]));
  const results = matches.map((note) => ({
    ...note,
    folderName: note.folderId ? (folderNameById.get(note.folderId) ?? null) : null,
  }));
  return NextResponse.json({ notes: results });
}