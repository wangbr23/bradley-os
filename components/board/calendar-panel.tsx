"use client";

import { forwardRef, type HTMLAttributes, useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";

import { getCalendarEventsSnapshot } from "@/app/actions/calendar";
import { type CalendarEvent } from "@/lib/calendar/format";
import type { AppTimeZone } from "@/lib/timezone";
import { tzShort } from "@/lib/timezone";
import { PanelShell } from "./panel-shell";
import { cachedCalendarWeeks } from "./dashboard-cache";

const WeekCalendar = dynamic(
  () => import("@/components/calendar/week-calendar").then((module) => module.WeekCalendar),
  { ssr: false, loading: () => <p className="panel-empty">Loading calendar…</p> },
);

interface CalendarPanelProps extends HTMLAttributes<HTMLDivElement> {
  today: Date;
  weekStart: Date;
  weekEnd: Date;
  timeZone: AppTimeZone;
}

export const CalendarPanel = forwardRef<HTMLDivElement, CalendarPanelProps>(
  function CalendarPanel({ today, weekStart, weekEnd, timeZone, ...rest }, ref) {
    const todayEyebrow = useMemo(() => {
      return new Intl.DateTimeFormat("en-US", { timeZone, month: "short", day: "numeric" }).format(today);
    }, [today, timeZone]);
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
        eyebrow={`Today, ${todayEyebrow}`}
        title={`Calendar ○ · ${tzShort(timeZone)} time`}
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
            <WeekCalendar events={events} initialDate={weekStart} compact timeZone={timeZone} />
          )
        }
      />
    );
  },
);
