"use client";

import type {
  DateSelectArg,
  EventChangeArg,
  EventClickArg,
  EventInput,
} from "@fullcalendar/core";
import interactionPlugin from "@fullcalendar/interaction";
import luxonPlugin from "@fullcalendar/luxon3";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import { useState } from "react";

import {
  createCalendarEvent,
  updateCalendarEvent,
} from "@/app/actions/calendar";
import {
  CALENDAR_TIME_ZONE,
  getDayKey,
  type CalendarEvent,
} from "@/lib/calendar/format";

interface WeekCalendarProps {
  events: CalendarEvent[];
  initialDate: Date;
  compact?: boolean;
}

function toFullCalendarEvent(event: CalendarEvent): EventInput {
  return {
    id: event.id,
    title: event.title,
    start: event.allDay ? getDayKey(event.start, true) : event.start.toISOString(),
    end: event.allDay ? getDayKey(event.end, true) : event.end.toISOString(),
    allDay: event.allDay,
    extendedProps: {
      location: event.location,
      htmlLink: event.htmlLink,
    },
  };
}

export function WeekCalendar({ events, initialDate, compact = false }: WeekCalendarProps) {
  const [visibleEvents, setVisibleEvents] = useState(events);
  const [writeError, setWriteError] = useState<string | null>(null);

  function handleEventClick(info: EventClickArg) {
    const htmlLink = info.event.extendedProps.htmlLink as string | undefined;
    if (htmlLink) window.open(htmlLink, "_blank", "noopener,noreferrer");
  }

  async function handleSelect(info: DateSelectArg) {
    info.view.calendar.unselect();
    const title = window.prompt("Event title")?.trim();
    if (!title) return;

    const temporaryId = `pending-${crypto.randomUUID()}`;
    const optimisticEvent: CalendarEvent = {
      id: temporaryId,
      title,
      start: info.start,
      end: info.end,
      allDay: info.allDay,
    };
    setWriteError(null);
    setVisibleEvents((current) => [...current, optimisticEvent]);

    try {
      const created = await createCalendarEvent({
        title,
        start: info.start,
        end: info.end,
        allDay: info.allDay,
      });
      setVisibleEvents((current) =>
        current.map((event) =>
          event.id === temporaryId ? { ...event, ...created } : event,
        ),
      );
    } catch {
      setVisibleEvents((current) =>
        current.filter((event) => event.id !== temporaryId),
      );
      setWriteError("Could not create the event. Your change was rolled back.");
    }
  }

  async function handleEventChange(info: EventChangeArg) {
    const changed = info.event;
    if (!changed.start) {
      info.revert();
      return;
    }
    const end = changed.end ?? new Date(changed.start.getTime() + 30 * 60 * 1000);
    const previousEvents = visibleEvents;
    setWriteError(null);
    setVisibleEvents((current) =>
      current.map((event) =>
        event.id === changed.id
          ? { ...event, start: changed.start!, end, allDay: changed.allDay }
          : event,
      ),
    );

    try {
      await updateCalendarEvent(changed.id, {
        start: changed.start,
        end,
        allDay: changed.allDay,
      });
    } catch {
      info.revert();
      setVisibleEvents(previousEvents);
      setWriteError("Could not update the event. Your change was rolled back.");
    }
  }

  return (
    <div className={`calendar-grid${compact ? " calendar-grid--compact" : ""}`}>
      <FullCalendar
        plugins={[timeGridPlugin, interactionPlugin, luxonPlugin]}
        initialView="timeGridWeek"
        initialDate={initialDate}
        firstDay={1}
        timeZone={CALENDAR_TIME_ZONE}
        headerToolbar={false}
        events={visibleEvents.map(toFullCalendarEvent)}
        editable
        selectable
        selectMirror
        select={handleSelect}
        eventChange={handleEventChange}
        nowIndicator
        allDaySlot
        allDayText="all day"
        slotMinTime={compact ? "07:00:00" : "06:00:00"}
        slotMaxTime="24:00:00"
        scrollTime="08:00:00"
        slotDuration="00:30:00"
        slotLabelInterval="01:00:00"
        expandRows
        height={compact ? "100%" : "auto"}
        eventClick={handleEventClick}
        eventTimeFormat={{
          hour: "numeric",
          minute: "2-digit",
          meridiem: "short",
        }}
        slotLabelFormat={{
          hour: "numeric",
          minute: "2-digit",
          meridiem: "short",
        }}
        dayHeaderFormat={{ weekday: "short", month: "numeric", day: "numeric" }}
      />
      {writeError ? (
        <p className="calendar-write-error" role="alert">
          {writeError}
        </p>
      ) : null}
    </div>
  );
}
