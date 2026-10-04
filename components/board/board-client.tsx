"use client";

import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

import { useCallback, useEffect, useRef, useState } from "react";
import GridLayout, { WidthProvider, type Layout } from "react-grid-layout";

import { saveLayout } from "@/app/actions/board-layout";
import { syncDirtyItems } from "@/app/actions/finance";
import type { FinanceSnapshot } from "@/lib/plaid/snapshot";
import { BankAccountsPanel } from "./bank-accounts-panel";
import { CalendarPanel } from "./calendar-panel";
import { CreditCardsPanel } from "./credit-cards-panel";
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
  { i: "bank-accounts", x: 8, y: 26, w: 4, h: 8 },
  { i: "credit-cards", x: 0, y: 24, w: 8, h: 8 },
];

// Position of a panel appended to a persisted layout that predates it
// (LLD §6.17): below the current bottom-most panel, never resetting saved
// positions (FR-3.7).
const APPENDED_LAYOUT: Record<string, Omit<Layout, "i" | "y">> = {
  todos: { x: 8, w: 4, h: 8 },
  "bank-accounts": { x: 8, w: 4, h: 8 },
  "credit-cards": { x: 0, w: 8, h: 8 },
};

const SAVE_DEBOUNCE_MS = 500;

interface BoardClientProps {
  initialLayout: Layout[] | null;
  today: Date;
  calendarWeekStart: Date;
  calendarWeekEnd: Date;
  recentNotes: RecentNote[];
  totalNotes: number;
  todos: BoardTodo[];
  financeSnapshot: FinanceSnapshot;
  now: Date;
}

function resolveLayout(initialLayout: Layout[] | null) {
  if (!initialLayout) return DEFAULT_LAYOUT;
  const withCalendarMinimum = initialLayout.map((item) =>
    item.i === "calendar"
      ? { ...item, h: Math.max(item.h, CALENDAR_MIN_HEIGHT), minH: CALENDAR_MIN_HEIGHT }
      : item,
  );
  const resolved = [...withCalendarMinimum];
  for (const [key, base] of Object.entries(APPENDED_LAYOUT)) {
    if (resolved.some((item) => item.i === key)) continue;
    const bottom = resolved.reduce(
      (maximum, item) => Math.max(maximum, item.y + item.h),
      0,
    );
    resolved.push({ i: key, y: bottom, ...base });
  }
  return resolved;
}

export function BoardClient({
  initialLayout,
  today,
  calendarWeekStart,
  calendarWeekEnd,
  recentNotes,
  totalNotes,
  todos,
  financeSnapshot,
  now,
}: BoardClientProps) {
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [finance, setFinance] = useState(financeSnapshot);

  // LLD §5.7.3: one post-mount dirty sync per page load (not per panel); the
  // webhook only sets dirty=1, so this is what moves new data onto the board.
  useEffect(() => {
    void syncDirtyItems()
      .then(setFinance)
      .catch(() => {});
  }, []);

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
      <BankAccountsPanel key="bank-accounts" snapshot={finance} />
      <CreditCardsPanel key="credit-cards" snapshot={finance} />
    </ResponsiveGridLayout>
  );
}