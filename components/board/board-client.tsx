"use client";

import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

import { useCallback, useRef } from "react";
import GridLayout, { WidthProvider, type Layout } from "react-grid-layout";

import { saveLayout } from "@/app/actions/board-layout";
import type { CalendarEvent } from "@/lib/calendar/format";
import type { InboxDigestMessage } from "@/lib/mail/inbox";
import { CalendarPanel } from "./calendar-panel";
import { InboxPanel } from "./inbox-panel";
import { NotesPanel, type RecentNote } from "./notes-panel";
import { TodosPanel, type BoardTodo } from "./todos-panel";

const ResponsiveGridLayout = WidthProvider(GridLayout);

const DEFAULT_LAYOUT: Layout[] = [
  { i: "calendar", x: 0, y: 0, w: 8, h: 10 },
  { i: "inbox", x: 0, y: 10, w: 8, h: 8 },
  { i: "notes", x: 8, y: 0, w: 4, h: 18 },
  { i: "todos", x: 8, y: 18, w: 4, h: 8 },
];

const SAVE_DEBOUNCE_MS = 500;

interface BoardClientProps {
  initialLayout: Layout[] | null;
  today: Date;
  todaysEvents: CalendarEvent[];
  weekActivity: boolean[];
  inboxMessages: InboxDigestMessage[];
  totalUnread: number;
  recentNotes: RecentNote[];
  totalNotes: number;
  todos: BoardTodo[];
  now: Date;
}

function resolveLayout(initialLayout: Layout[] | null) {
  if (!initialLayout) return DEFAULT_LAYOUT;
  if (initialLayout.some((item) => item.i === "todos")) return initialLayout;

  const bottom = initialLayout.reduce(
    (maximum, item) => Math.max(maximum, item.y + item.h),
    0,
  );
  return [
    ...initialLayout,
    { i: "todos", x: 8, y: bottom, w: 4, h: 8 },
  ];
}

export function BoardClient({
  initialLayout,
  today,
  todaysEvents,
  weekActivity,
  inboxMessages,
  totalUnread,
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
        todaysEvents={todaysEvents}
        weekActivity={weekActivity}
      />
      <InboxPanel key="inbox" messages={inboxMessages} totalUnread={totalUnread} />
      <NotesPanel key="notes" notes={recentNotes} totalCount={totalNotes} now={now} />
      <TodosPanel key="todos" todos={todos} />
    </ResponsiveGridLayout>
  );
}
