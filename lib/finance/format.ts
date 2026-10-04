// Pure formatting helpers for finance panel presentation — no Node/server
// dependency, so this is safe to import from client components.

// Plaid dates are YYYY-MM-DD; parse as UTC so the day never shifts locally.
const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

export function formatTransactionDate(date: string) {
  return dateFormatter.format(new Date(`${date}T00:00:00Z`));
}

export function formatMoney(amount: number, currencyCode: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
  }).format(Math.abs(amount));
}