import { describe, expect, it } from "vitest";
import { createTestDb } from "./test-harness";
import { todos } from "./schema";

describe("createTestDb", () => {
  it("applies the generated migrations and round-trips a row", async () => {
    const db = await createTestDb();

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

  it("keeps rows readable after a transaction commits", async () => {
    const db = await createTestDb();

    await db.transaction(async (tx) => {
      await tx.insert(todos).values({
        id: "t-tx",
        text: "written in tx",
        createdAt: new Date(0),
      });
    });

    const rows = await db.select().from(todos);
    expect(rows).toHaveLength(1);
    expect(rows[0].text).toBe("written in tx");
  });
});
