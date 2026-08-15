// Pure date/formatting helpers for calendar events — no Node/server dependency,
// so this is safe to import from client components. lib/calendar/google.ts
// (server-only, pulls in googleapis) re-exports these for the full pages.

export const CALENDAR_TIME_ZONE = "America/Los_Angeles";

const dayKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: CALENDAR_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  location?: string;
  htmlLink?: string;
}

export function getDayKey(date: Date, allDay = false) {
  if (allDay) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  return dayKeyFormatter.format(date);
}

