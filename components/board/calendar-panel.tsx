"use client";

import { forwardRef, type HTMLAttributes, useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { getCalendarEventsSnapshot } from "@/app/actions/calendar";
import { WeekCalendar } from "@/components/calendar/week-calendar";
import { CALENDAR_TIME_ZONE, type CalendarEvent } from "@/lib/calendar/format";
import { PanelShell } from "./panel-shell";
import { cachedCalendarWeeks } from "./dashboard-cache";

const todayEyebrowFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: CALENDAR_TIME_ZONE,
  month: "short",
  day: "numeric",
});

interface CalendarPanelProps extends HTMLAttributes<HTMLDivElement> {
  today: Date;
  weekStart: Date;
  weekEnd: Date;
}

export const CalendarPanel = forwardRef<HTMLDivElement, CalendarPanelProps>(
  function CalendarPanel({ today, weekStart, weekEnd, ...rest }, ref) {
    const cacheKey = `${weekStart.toISOString()}:${weekEnd.toISOString()}`;
    const [events, setEvents] = useState<CalendarEvent[]>(
      () => cachedCalendarWeeks.get(cacheKey) ?? [],
    );
    const [loading, setLoading] = useState(!cachedCalendarWeeks.has(cacheKey));
    const [error, setError] = useState(false);

    const load = useCallback(async (force = false) => {
      setLoading(true);
      setError(false);
      try {
        const snapshot = await getCalendarEventsSnapshot(weekStart, weekEnd, force);
        setEvents(snapshot.events);
        cachedCalendarWeeks.set(cacheKey, snapshot.events);
        if (snapshot.stale && !force) {
          const fresh = await getCalendarEventsSnapshot(weekStart, weekEnd, true);
          setEvents(fresh.events);
          cachedCalendarWeeks.set(cacheKey, fresh.events);
        }
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }, [cacheKey, weekEnd, weekStart]);

    useEffect(() => {
      void load(false);
    }, [load]);

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
          <div className="panel-footer-actions">
            <Link href="/calendar" className="ink-action">View week →</Link>
            <button type="button" className="ink-action" onClick={() => void load(true)}>Refresh</button>
          </div>
        }
        rows={
          loading && events.length === 0 ? (
            <p className="panel-empty">Loading calendar…</p>
          ) : error && events.length === 0 ? (
            <p className="panel-empty">Calendar unavailable.</p>
          ) : (
            <WeekCalendar events={events} initialDate={weekStart} compact />
          )
        }
      />
    );
  },
);
