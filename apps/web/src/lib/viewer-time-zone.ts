import { cookies } from "next/headers";

import { safeTimeZone, timeZoneCookie } from "~/src/lib/time-zone";

/** The viewer's time zone from the cookie their browser sets, or UTC. */
export async function getViewerTimeZone() {
  return safeTimeZone((await cookies()).get(timeZoneCookie)?.value);
}
