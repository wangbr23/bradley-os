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
import styles from "./page.module.css";

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
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>
            {formatRange(range.start, range.end)}
          </p>
          <h1 className={styles.title}>
            Calendar
          </h1>
        </div>
        <Link href="/" className="ink-action">
          Today
        </Link>
      </header>

      {error ? (
        <section className={styles.error}>
          <h2 className={styles.errorTitle}>
            Calendar unavailable
          </h2>
          <p className={styles.errorCopy}>
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
