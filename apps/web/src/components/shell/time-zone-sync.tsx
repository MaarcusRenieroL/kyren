"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { timeZoneCookie } from "~/src/lib/time-zone";

/**
 * Tells the server the browser's time zone, so "today" on server-rendered
 * pages is the viewer's day. Re-renders once when the zone was unknown or
 * has changed (a laptop that travelled).
 */
export function TimeZoneSync() {
  const router = useRouter();

  useEffect(() => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    if (!zone) return;

    const current = document.cookie
      .split("; ")
      .find((entry) => entry.startsWith(`${timeZoneCookie}=`))
      ?.slice(timeZoneCookie.length + 1);

    if (current && decodeURIComponent(current) === zone) return;

    document.cookie = `${timeZoneCookie}=${encodeURIComponent(zone)}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }, [router]);

  return null;
}
