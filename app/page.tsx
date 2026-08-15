import { asc, desc } from "drizzle-orm";
import type { Layout } from "react-grid-layout";

import { auth, signOut } from "@/auth";
import { getHomeLayout } from "@/app/actions/board-layout";
import { BoardClient } from "@/components/board/board-loader";
import {
  getDayKey,
  getPrimaryCalendarEvents,
  getSevenDayCalendarRange,
  type CalendarEvent,
} from "@/lib/calendar/google";
import { db } from "@/lib/db/client";
import { notes, todos } from "@/lib/db/schema";
import { getInboxDigest, type InboxDigestMessage } from "@/lib/mail/inbox";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await auth();
  const range = getSevenDayCalendarRange();
  const hasCalendarAccess = Boolean(session?.googleAccessToken) && !session?.googleTokenError;

  const [calendarEvents, inboxMessages, noteList, todoList, persistedLayout] = await Promise.all([
    hasCalendarAccess
      ? getPrimaryCalendarEvents(session!.googleAccessToken!, range).catch(
          () => [] as CalendarEvent[],
        )
      : Promise.resolve([] as CalendarEvent[]),
    getInboxDigest().catch(() => [] as InboxDigestMessage[]),
    db
      .select({ id: notes.id, title: notes.title, updatedAt: notes.updatedAt })
      .from(notes)
      .orderBy(desc(notes.updatedAt)),
    db
      .select({ id: todos.id, text: todos.text, done: todos.done })
      .from(todos)
      .orderBy(asc(todos.done), desc(todos.createdAt)),
    getHomeLayout(),
  ]);

  const todayKey = getDayKey(range.start);
  const todaysEvents = calendarEvents
    .filter((event) => getDayKey(event.start, event.allDay) === todayKey)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const weekActivity = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(range.start);
    date.setDate(date.getDate() + index);
    const key = getDayKey(date);
    return calendarEvents.some((event) => getDayKey(event.start, event.allDay) === key);
  });

  const initialLayout = Array.isArray(persistedLayout) ? (persistedLayout as Layout[]) : null;

  return (
    <div className="flex-1 px-6 py-10 sm:px-10">
      <div className="mx-auto w-full max-w-5xl">
        <div className="max-w-sm">
          <div className="ledger-rule" />
          <div className="mt-3 flex items-baseline justify-between">
            <p className="font-mono text-xs uppercase tracking-wider text-[color:var(--muted)]">
              ○ Signed in
            </p>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/sign-in" });
              }}
            >
              <button type="submit" className="ink-action">
                ✕ Sign out
              </button>
            </form>
          </div>
          <h1 className="mt-4 font-mono text-2xl font-bold tracking-tight">bradley-os</h1>
          <p className="mt-4 font-serif text-base leading-7 text-[color:var(--muted)]">
            – Welcome, {session?.user?.name ?? session?.user?.email}.
          </p>
        </div>

        <div className="mt-10">
          <BoardClient
            initialLayout={initialLayout}
            today={range.start}
            todaysEvents={todaysEvents}
            weekActivity={weekActivity}
            inboxMessages={inboxMessages.slice(0, 3)}
            totalUnread={inboxMessages.length}
            recentNotes={noteList.slice(0, 3)}
            totalNotes={noteList.length}
            todos={todoList}
            now={new Date()}
          />
        </div>
      </div>
    </div>
  );
}
