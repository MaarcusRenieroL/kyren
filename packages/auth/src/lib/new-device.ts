import { db } from "@zentro/db";
import { and, eq, sql } from "@zentro/db/drizzle";
import { activityEvents } from "@zentro/db/schema";

/**
 * True when this person has signed in before, but never from this browser.
 * The very first sign-in has nothing to compare with, and a request that
 * names no browser cannot be judged, so neither raises an alert.
 */
export async function isNewDevice(userId: string, userAgent: string | null) {
  if (!userAgent) return false;

  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      same: sql<number>`count(*) filter (where ${activityEvents.userAgent} = ${userAgent})::int`,
    })
    .from(activityEvents)
    .where(
      and(
        eq(activityEvents.actorUserId, userId),
        eq(activityEvents.action, "auth.sign_in"),
      ),
    );

  return (row?.total ?? 0) > 0 && (row?.same ?? 0) === 0;
}
