import type { CalendarEvent } from "@/lib/calendar/format";
import type { InboxDigestMessage } from "@/lib/mail/inbox";

export let cachedInbox: InboxDigestMessage[] | null = null;
export const cachedCalendarWeeks = new Map<string, CalendarEvent[]>();

export function setCachedInbox(messages: InboxDigestMessage[]) {
  cachedInbox = messages;
}
