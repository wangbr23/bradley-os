import { describe, expect, it } from "vitest";
import { createInMemoryDb } from "./test-harness";
import { todos } from "./schema";

describe("createInMemoryDb", () => {
  it("applies the generated migrations and round-trips a row", async () => {
    const db = await createInMemoryDb();

    await db.insert(todos).values({
      id: "t1",
      text: "harness smoke",
      createdAt: new Date(0),
    });

    const rows = await db.select().from(todos);
    expect(rows).toHaveLength(1);
    expect(rows[0].text).toBe("harness smoke");
    expect(rows[0].done).toBe(false);
  });
});
