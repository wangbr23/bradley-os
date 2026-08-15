import { forwardRef, type HTMLAttributes } from "react";
import Link from "next/link";

import { CALENDAR_TIME_ZONE, formatTime, type CalendarEvent } from "@/lib/calendar/format";
import { PanelShell } from "./panel-shell";

const startTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: CALENDAR_TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
});

const todayEyebrowFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: CALENDAR_TIME_ZONE,
  month: "short",
  day: "numeric",
});

interface CalendarPanelProps extends HTMLAttributes<HTMLDivElement> {
  today: Date;
  todaysEvents: CalendarEvent[];
  /** Whether each of the next 7 days (today first) has at least one event. */
  weekActivity: boolean[];
}

export const CalendarPanel = forwardRef<HTMLDivElement, CalendarPanelProps>(
  function CalendarPanel({ today, todaysEvents, weekActivity, ...rest }, ref) {
    const [next, ...rest_] = todaysEvents;

    return (
      <PanelShell
        ref={ref}
        {...rest}
        glyph="○"
        eyebrow={`Today, ${todayEyebrowFormatter.format(today)}`}
        title="Calendar ○"
        statValue={next ? (next.allDay ? "All day" : startTimeFormatter.format(next.start)) : "—"}
        statLabel={next ? `next — ${next.title}` : "Nothing scheduled"}
        afterStat={
          <div className="panel-week-strip" aria-hidden="true">
            {weekActivity.map((busy, index) => (
              <span
                key={index}
                className="panel-week-dot"
                data-busy={busy}
                data-today={index === 0}
              />
            ))}
          </div>
        }
        footer={
          <Link href="/calendar" className="ink-action">
            View week →
          </Link>
        }
        rows={
          rest_.length === 0 ? (
            <p className="panel-empty">Nothing else today.</p>
          ) : (
            rest_.map((event) => (
              <div className="panel-row" key={event.id}>
                <p className="row-main">
                  <span className="glyph">○</span>
                  {event.title}
                </p>
                <p className="row-time">{formatTime(event)}</p>
              </div>
            ))
          )
        }
      />
    );
  },
);
