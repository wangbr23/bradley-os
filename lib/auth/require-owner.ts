import "server-only";

import { auth } from "@/auth";

export async function requireOwner() {
  const session = await auth();
  const ownerEmail = process.env.OWNER_EMAIL?.trim().toLowerCase();
  if (!ownerEmail || session?.user?.email?.toLowerCase() !== ownerEmail) {
    throw new Error("Unauthorized");
  }
}
