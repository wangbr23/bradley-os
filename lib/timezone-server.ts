import { cookies } from "next/headers";
import { type AppTimeZone, TZ_COOKIE, TZ_EASTERN, TZ_PACIFIC } from "./timezone";

export async function getServerTimeZone(): Promise<AppTimeZone> {
  const jar = await cookies();
  const val = jar.get(TZ_COOKIE)?.value;
  return val === "et" ? TZ_EASTERN : TZ_PACIFIC;
}
