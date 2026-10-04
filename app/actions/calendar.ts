"use server";

import { auth } from "@/auth";
import { getGoogleToken } from "@/lib/auth/google-token";
import {
  createPrimaryCalendarEvent,
  getPrimaryCalendarEventsSnapshot,
  updatePrimaryCalendarEvent,
  type CalendarEventWrite,
} from "@/lib/calendar/google";

async function requireCalendarAccess() {
  const session = await auth();
  const token = await getGoogleToken();
  if (!session?.user || !token.accessToken || token.error) {
    throw new Error("Google Calendar access is unavailable");
  }
  return token.accessToken;
}

export async function getCalendarEvents(start: Date, end: Date) {
  const snapshot = await getPrimaryCalendarEventsSnapshot(
    await requireCalendarAccess(),
    { start, end },
  );
  return snapshot.events;
}

export async function getCalendarEventsSnapshot(
  start: Date,
  end: Date,
  force = false,
) {
  return getPrimaryCalendarEventsSnapshot(
    await requireCalendarAccess(),
    { start, end },
    force,
  );
}

export async function createCalendarEvent(
  input: CalendarEventWrite & { title: string },
) {
  return createPrimaryCalendarEvent(await requireCalendarAccess(), input);
}

export async function updateCalendarEvent(
  eventId: string,
  input: CalendarEventWrite,
) {
  await updatePrimaryCalendarEvent(
    await requireCalendarAccess(),
    eventId,
    input,
  );
}
