import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { WeekCalendar } from "@/components/calendar/week-calendar";
import {
  CALENDAR_TIME_ZONE,
  getCurrentCalendarWeekRange,
  getPrimaryCalendarEvents,
  type CalendarEvent,
} from "@/lib/calendar/google";

export const dynamic = "force-dynamic";

function formatRange(start: Date, end: Date) {
  const inclusiveEnd = new Date(end.getTime() - 1);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: CALENDAR_TIME_ZONE,
    month: "short",
    day: "numeric",
  });
  return `${formatter.format(start)}–${formatter.format(inclusiveEnd)}`;
}

export default async function CalendarPage() {
  const session = await auth();
  if (!session) redirect("/sign-in");

  const range = getCurrentCalendarWeekRange();
  let events: CalendarEvent[] = [];
  let error: "access" | "request" | null = null;

  if (!session.googleAccessToken || session.googleTokenError) {
    error = "access";
  } else {
    try {
      events = await getPrimaryCalendarEvents(session.googleAccessToken, range);
    } catch (cause) {
      error = "request";
      console.error(
        "Unable to load calendar:",
        cause instanceof Error ? cause.message : "Unknown Calendar API error",
      );
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8">
      <header className="flex items-end justify-between border-b border-[color:var(--border)] pb-5">
        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-[color:var(--accent)]">
            {formatRange(range.start, range.end)}
          </p>
          <h1 className="mt-2 font-mono text-3xl font-bold tracking-tight">
            Calendar
          </h1>
        </div>
        <Link href="/" className="ink-action">
          Today
        </Link>
      </header>

      {error ? (
        <section className="border-b border-[color:var(--border)] py-12">
          <h2 className="font-mono text-sm font-bold uppercase tracking-wide">
            Calendar unavailable
          </h2>
          <p className="mt-3 max-w-lg text-sm leading-6 text-[color:var(--muted)]">
            {error === "access"
              ? "Google Calendar access needs to be renewed. Sign out, then sign in and approve Calendar access."
              : "Bradley OS could not reach Google Calendar. Refresh to try again."}
          </p>
        </section>
      ) : (
        <WeekCalendar events={events} initialDate={range.start} />
      )}
    </main>
  );
}
