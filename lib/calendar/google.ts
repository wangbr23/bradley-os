import "server-only";

import { google, type calendar_v3 } from "googleapis";

import { CALENDAR_TIME_ZONE, getDayKey, type CalendarEvent } from "./format";

export { CALENDAR_TIME_ZONE, getDayKey, type CalendarEvent } from "./format";

export interface CalendarRange {
  start: Date;
  end: Date;
}

export interface CalendarEventWrite {
  title?: string;
  start: Date;
  end: Date;
  allDay: boolean;
}

const CALENDAR_CACHE_TTL_MS = 60_000;
const calendarCache = new Map<
  string,
  { events: CalendarEvent[]; fetchedAt: number }
>();
const calendarRefreshes = new Map<string, Promise<CalendarEvent[]>>();

function getDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CALENDAR_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  return Object.fromEntries(parts.map((part) => [part.type, part.value])) as {
    year: string;
    month: string;
    day: string;
  };
}

function getOffsetMilliseconds(date: Date) {
  const offsetName = new Intl.DateTimeFormat("en-US", {
    timeZone: CALENDAR_TIME_ZONE,
    timeZoneName: "longOffset",
  })
    .formatToParts(date)
    .find((part) => part.type === "timeZoneName")?.value;
  const match = offsetName?.match(/^GMT([+-])(\d{2}):(\d{2})$/);

  if (!match) throw new Error("Unable to determine the calendar timezone");

  const milliseconds =
    (Number(match[2]) * 60 + Number(match[3])) * 60 * 1000;
  return match[1] === "+" ? milliseconds : -milliseconds;
}

function zonedMidnight(year: number, month: number, day: number) {
  const approximate = new Date(Date.UTC(year, month - 1, day));
  return new Date(approximate.getTime() - getOffsetMilliseconds(approximate));
}

export function getCurrentCalendarWeekRange(now = new Date()): CalendarRange {
  const { year, month, day } = getDateParts(now);
  const localDate = new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day)),
  );
  const daysSinceMonday = (localDate.getUTCDay() + 6) % 7;
  localDate.setUTCDate(localDate.getUTCDate() - daysSinceMonday);
  const endDate = new Date(localDate);
  endDate.setUTCDate(endDate.getUTCDate() + 7);

  return {
    start: zonedMidnight(
      localDate.getUTCFullYear(),
      localDate.getUTCMonth() + 1,
      localDate.getUTCDate(),
    ),
    end: zonedMidnight(
      endDate.getUTCFullYear(),
      endDate.getUTCMonth() + 1,
      endDate.getUTCDate(),
    ),
  };
}

function normalizeEvent(event: calendar_v3.Schema$Event): CalendarEvent | null {
  const allDay = Boolean(event.start?.date);
  const startValue = event.start?.dateTime ?? event.start?.date;
  const endValue = event.end?.dateTime ?? event.end?.date;

  if (!event.id || !startValue || !endValue || event.status === "cancelled") {
    return null;
  }

  return {
    id: event.id,
    title: event.summary?.trim() || "(Untitled event)",
    start: allDay
      ? new Date(`${startValue}T00:00:00`)
      : new Date(startValue),
    end: allDay ? new Date(`${endValue}T00:00:00`) : new Date(endValue),
    allDay,
    location: event.location || undefined,
    htmlLink: event.htmlLink || undefined,
  };
}

function toGoogleEventTimes(input: CalendarEventWrite) {
  if (input.allDay) {
    return {
      start: { date: getDayKey(input.start) },
      end: { date: getDayKey(input.end) },
    };
  }

  return {
    start: { dateTime: input.start.toISOString(), timeZone: CALENDAR_TIME_ZONE },
    end: { dateTime: input.end.toISOString(), timeZone: CALENDAR_TIME_ZONE },
  };
}

export async function createPrimaryCalendarEvent(
  accessToken: string,
  input: CalendarEventWrite & { title: string },
) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const calendar = google.calendar({ version: "v3", auth });
  const response = await calendar.events.insert({
    calendarId: "primary",
    requestBody: {
      summary: input.title,
      ...toGoogleEventTimes(input),
    },
  });

  if (!response.data.id) throw new Error("Google Calendar did not return an event ID");
  calendarCache.clear();
  return { id: response.data.id, htmlLink: response.data.htmlLink ?? undefined };
}

export async function updatePrimaryCalendarEvent(
  accessToken: string,
  eventId: string,
  input: CalendarEventWrite,
) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const calendar = google.calendar({ version: "v3", auth });
  await calendar.events.patch({
    calendarId: "primary",
    eventId,
    requestBody: toGoogleEventTimes(input),
  });
  calendarCache.clear();
}

export async function getPrimaryCalendarEvents(
  accessToken: string,
  range: CalendarRange,
) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const calendar = google.calendar({ version: "v3", auth });
  const response = await calendar.events.list({
    calendarId: "primary",
    timeMin: range.start.toISOString(),
    timeMax: range.end.toISOString(),
    timeZone: CALENDAR_TIME_ZONE,
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 100,
  });

  return (response.data.items ?? [])
    .map(normalizeEvent)
    .filter((event): event is CalendarEvent => event !== null);
}

export async function getPrimaryCalendarEventsSnapshot(
  accessToken: string,
  range: CalendarRange,
  force = false,
) {
  const key = `${range.start.toISOString()}:${range.end.toISOString()}`;
  const cached = calendarCache.get(key);
  const now = Date.now();
  if (!force && cached) {
    const stale = now - cached.fetchedAt >= CALENDAR_CACHE_TTL_MS;
    if (stale && !calendarRefreshes.has(key)) {
      const refresh = getPrimaryCalendarEvents(accessToken, range)
        .then((events) => {
          calendarCache.set(key, { events, fetchedAt: Date.now() });
          return events;
        })
        .finally(() => {
          calendarRefreshes.delete(key);
        });
      calendarRefreshes.set(key, refresh);
    }
    return {
      events: cached.events,
      stale,
    };
  }

  let refresh = calendarRefreshes.get(key);
  if (!refresh) {
    refresh = getPrimaryCalendarEvents(accessToken, range).finally(() => {
      calendarRefreshes.delete(key);
    });
    calendarRefreshes.set(key, refresh);
  }
  const events = await refresh;
  calendarCache.set(key, { events, fetchedAt: Date.now() });
  return { events, stale: false };
}
