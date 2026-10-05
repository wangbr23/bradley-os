"use client";

import { useRouter } from "next/navigation";
import { type AppTimeZone, TZ_COOKIE, TZ_EASTERN, TZ_PACIFIC, tzShort } from "@/lib/timezone";

export function TimezoneToggle({ current }: { current: AppTimeZone }) {
  const router = useRouter();

  function toggle() {
    const next = current === TZ_PACIFIC ? "et" : "pt";
    document.cookie = `${TZ_COOKIE}=${next};path=/;max-age=31536000;samesite=lax`;
    router.refresh();
  }

  const other = current === TZ_PACIFIC ? TZ_EASTERN : TZ_PACIFIC;

  return (
    <button type="button" className="tz-toggle" onClick={toggle} title={`Switch to ${tzShort(other)}`}>
      <span className="tz-toggle-active">{tzShort(current)}</span>
      <span className="tz-toggle-sep">/</span>
      <span className="tz-toggle-inactive">{tzShort(other)}</span>
    </button>
  );
}
