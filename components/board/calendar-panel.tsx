import { forwardRef, type HTMLAttributes } from "react";
import Link from "next/link";

import { WeekCalendar } from "@/components/calendar/week-calendar";
import { CALENDAR_TIME_ZONE, type CalendarEvent } from "@/lib/calendar/format";
import { PanelShell } from "./panel-shell";

const todayEyebrowFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: CALENDAR_TIME_ZONE,
  month: "short",
  day: "numeric",
});

interface CalendarPanelProps extends HTMLAttributes<HTMLDivElement> {
  today: Date;
  events: CalendarEvent[];
  weekStart: Date;
}

export const CalendarPanel = forwardRef<HTMLDivElement, CalendarPanelProps>(
  function CalendarPanel({ today, events, weekStart, ...rest }, ref) {
    return (
      <PanelShell
        ref={ref}
        {...rest}
        glyph="○"
        eyebrow={`Today, ${todayEyebrowFormatter.format(today)}`}
        title="Calendar ○ · Pacific time"
        statValue={String(events.length)}
        statLabel={events.length === 1 ? "event this week" : "events this week"}
        footer={
          <Link href="/calendar" className="ink-action">
            View week →
          </Link>
        }
        rows={<WeekCalendar events={events} initialDate={weekStart} compact />}
      />
    );
  },
);
