export const TZ_PACIFIC = "America/Los_Angeles";
export const TZ_EASTERN = "America/New_York";
export type AppTimeZone = typeof TZ_PACIFIC | typeof TZ_EASTERN;

export const TZ_COOKIE = "tz";

export function tzLabel(tz: AppTimeZone): string {
  return tz === TZ_EASTERN ? "Eastern" : "Pacific";
}

export function tzShort(tz: AppTimeZone): string {
  return tz === TZ_EASTERN ? "ET" : "PT";
}
