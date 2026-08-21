"use server";

import { requireOwner } from "@/lib/auth/require-owner";
import { getInboxDigestSnapshot } from "@/lib/mail/inbox";

export async function getInboxData(force = false) {
  await requireOwner();
  return getInboxDigestSnapshot(force);
}
