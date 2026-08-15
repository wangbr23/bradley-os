"use client";

import type { EventClickArg, EventInput } from "@fullcalendar/core";
import interactionPlugin from "@fullcalendar/interaction";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";

import {
  CALENDAR_TIME_ZONE,
  getDayKey,
  type CalendarEvent,
} from "@/lib/calendar/format";

interface WeekCalendarProps {
  events: CalendarEvent[];
  initialDate: Date;
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

export function WeekCalendar({ events, initialDate }: WeekCalendarProps) {
  function handleEventClick(info: EventClickArg) {
    const htmlLink = info.event.extendedProps.htmlLink as string | undefined;
    if (htmlLink) window.open(htmlLink, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="calendar-grid">
      <FullCalendar
        plugins={[timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        initialDate={initialDate}
        firstDay={1}
        timeZone={CALENDAR_TIME_ZONE}
        headerToolbar={false}
        events={events.map(toFullCalendarEvent)}
        nowIndicator
        allDaySlot
        allDayText="all day"
        slotMinTime="06:00:00"
        slotMaxTime="24:00:00"
        scrollTime="08:00:00"
        slotDuration="00:30:00"
        slotLabelInterval="01:00:00"
        expandRows
        height="auto"
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
    </div>
  );
}
