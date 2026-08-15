"use server";

import { auth } from "@/auth";
import {
  createPrimaryCalendarEvent,
  getPrimaryCalendarEvents,
  updatePrimaryCalendarEvent,
  type CalendarEventWrite,
} from "@/lib/calendar/google";

async function requireCalendarAccess() {
  const session = await auth();
  if (!session?.user || !session.googleAccessToken || session.googleTokenError) {
    throw new Error("Google Calendar access is unavailable");
  }
  return session.googleAccessToken;
}

export async function getCalendarEvents(start: Date, end: Date) {
  return getPrimaryCalendarEvents(await requireCalendarAccess(), { start, end });
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
