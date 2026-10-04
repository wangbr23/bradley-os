// Pure formatting helpers for finance panel presentation — no Node/server
// dependency, so this is safe to import from client components.

import { CALENDAR_TIME_ZONE } from "@/lib/calendar/format";

// Plaid dates are YYYY-MM-DD; parse as UTC so the day never shifts locally.
const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

export function formatTransactionDate(date: string) {
  return dateFormatter.format(new Date(`${date}T00:00:00Z`));
}

// Transaction amounts: absolute value with an explicit sign handled by the
// caller (stored negative = money in → "+" prefix, positive = money out).
export function formatTransactionAmount(amount: number, currencyCode: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
  }).format(Math.abs(amount));
}

// Account balances: signed as stored (overdrafts render as -$12.34).
export function formatMoney(amount: number, currencyCode: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
  }).format(amount);
}

const updatedTimeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: CALENDAR_TIME_ZONE,
});

const updatedDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: CALENDAR_TIME_ZONE,
});

export function formatLastUpdated(lastSyncAt: Date | string | null) {
  if (!lastSyncAt) return "Never synced";
  const date = new Date(lastSyncAt);
  const sameDay =
    updatedDateFormatter.format(date) === updatedDateFormatter.format(new Date());
  return sameDay
    ? `Updated ${updatedTimeFormatter.format(date)}`
    : `Updated ${updatedDateFormatter.format(date)}`;
}