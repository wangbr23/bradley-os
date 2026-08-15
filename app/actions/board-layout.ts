"use server";

import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { layouts } from "@/lib/db/schema";
import { requireOwner } from "@/lib/auth/require-owner";

const HOME_LAYOUT_ID = "home";

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
