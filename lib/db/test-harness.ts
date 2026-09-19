import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

// File-backed (not :memory:) on purpose: the local @libsql/client driver parks
// its connection while a transaction is open and lazily opens a fresh one on
// the next use, and a fresh :memory: connection is an empty database. A
// per-database temp file keeps every connection pointed at the same data.
// Temp files are left behind for OS temp-dir cleanup.
export async function createTestDb() {
  const dir = mkdtempSync(`${tmpdir()}/bradley-os-test-`);
  const client = createClient({ url: `file:${dir}/test.db` });
  const migrationsDir = `${import.meta.dirname}/migrations`;
  const migrationFiles = readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of migrationFiles) {
    const sql = readFileSync(`${migrationsDir}/${file}`, "utf8");
    for (const statement of sql.split("--> statement-breakpoint")) {
      if (statement.trim()) {
        await client.execute(statement);
      }
    }
  }

  return drizzle(client, { schema });
}
