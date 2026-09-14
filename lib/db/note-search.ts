import { or, sql, type SQL } from "drizzle-orm";

import { notes } from "./schema";

function escapeLike(term: string) {
  return term.replace(/[\\%_]/g, (char) => `\\${char}`);
}

// SQLite LIKE is case-insensitive for ASCII by default; matching the raw
// body_json text also catches words inside the serialized Tiptap document.
export function searchClause(term: string): SQL | undefined {
  const pattern = `%${escapeLike(term)}%`;
  return or(
    sql`${notes.title} LIKE ${pattern} ESCAPE '\\'`,
    sql`${notes.bodyJson} LIKE ${pattern} ESCAPE '\\'`,
  );
}