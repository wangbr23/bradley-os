"use client";

import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

import { useCallback, useRef } from "react";
import GridLayout, { WidthProvider, type Layout } from "react-grid-layout";

import { saveLayout } from "@/app/actions/board-layout";
import { CalendarPanel } from "./calendar-panel";
import { InboxPanel } from "./inbox-panel";
import { NotesPanel, type RecentNote } from "./notes-panel";
import { TodosPanel, type BoardTodo } from "./todos-panel";

const ResponsiveGridLayout = WidthProvider(GridLayout);

const CALENDAR_MIN_HEIGHT = 12;

const DEFAULT_LAYOUT: Layout[] = [
  { i: "calendar", x: 0, y: 0, w: 8, h: 16, minH: CALENDAR_MIN_HEIGHT },
  { i: "inbox", x: 0, y: 16, w: 8, h: 8 },
  { i: "notes", x: 8, y: 0, w: 4, h: 18 },
  { i: "todos", x: 8, y: 18, w: 4, h: 8 },
];

const SAVE_DEBOUNCE_MS = 500;

interface BoardClientProps {
  initialLayout: Layout[] | null;
  today: Date;
  calendarWeekStart: Date;
  calendarWeekEnd: Date;
  recentNotes: RecentNote[];
  totalNotes: number;
  todos: BoardTodo[];
  now: Date;
}

function resolveLayout(initialLayout: Layout[] | null) {
  if (!initialLayout) return DEFAULT_LAYOUT;
  const withCalendarMinimum = initialLayout.map((item) =>
    item.i === "calendar"
      ? { ...item, h: Math.max(item.h, CALENDAR_MIN_HEIGHT), minH: CALENDAR_MIN_HEIGHT }
      : item,
  );
  if (withCalendarMinimum.some((item) => item.i === "todos")) return withCalendarMinimum;

  const bottom = withCalendarMinimum.reduce(
    (maximum, item) => Math.max(maximum, item.y + item.h),
    0,
  );
  return [
    ...withCalendarMinimum,
    { i: "todos", x: 8, y: bottom, w: 4, h: 8 },
  ];
}

export function BoardClient({
  initialLayout,
  today,
  calendarWeekStart,
  calendarWeekEnd,
  recentNotes,
  totalNotes,
  todos,
  now,
}: BoardClientProps) {
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persistLayout = useCallback((layout: Layout[]) => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      void saveLayout(layout);
    }, SAVE_DEBOUNCE_MS);
  }, []);

  return (
    <ResponsiveGridLayout
      className="board-grid"
      layout={resolveLayout(initialLayout)}
      cols={12}
      rowHeight={24}
      margin={[24, 24]}
      draggableHandle=".panel-drag-handle"
      resizeHandles={["se"]}
      onDragStop={(layout) => persistLayout(layout)}
      onResizeStop={(layout) => persistLayout(layout)}
    >
      <CalendarPanel
        key="calendar"
        today={today}
        weekStart={calendarWeekStart}
        weekEnd={calendarWeekEnd}
      />
      <InboxPanel key="inbox" />
      <NotesPanel key="notes" notes={recentNotes} totalCount={totalNotes} now={now} />
      <TodosPanel key="todos" todos={todos} />
    </ResponsiveGridLayout>
  );
}
