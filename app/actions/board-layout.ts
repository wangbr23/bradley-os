"use server";

import { eq } from "drizzle-orm";

import { auth } from "@/auth";
import { db } from "@/lib/db/client";
import { layouts } from "@/lib/db/schema";

const HOME_LAYOUT_ID = "home";

async function requireOwner() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
}

export async function saveLayout(layoutJson: unknown) {
  await requireOwner();

  const now = new Date();
  await db
    .insert(layouts)
    .values({ id: HOME_LAYOUT_ID, layoutJson, updatedAt: now })
    .onConflictDoUpdate({
      target: layouts.id,
      set: { layoutJson, updatedAt: now },
    });
}

export async function getHomeLayout() {
  const [row] = await db
    .select({ layoutJson: layouts.layoutJson })
    .from(layouts)
    .where(eq(layouts.id, HOME_LAYOUT_ID));

  return row?.layoutJson ?? null;
}
