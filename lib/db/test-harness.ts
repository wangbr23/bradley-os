import { readdirSync, readFileSync } from "node:fs";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

export async function createInMemoryDb() {
  const client = createClient({ url: ":memory:" });
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
