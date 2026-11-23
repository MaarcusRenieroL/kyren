import { db } from "@kyren/db";
import { and, asc, eq } from "@kyren/db/drizzle";
import { activityEvents } from "@kyren/db/schema";
import { type TestOrg } from "./world";

export async function fetchEvents(org: TestOrg, action?: string) {
  const rows = await db
    .select()
    .from(activityEvents)
    .where(
      action
        ? and(
            eq(activityEvents.organizationId, org.id),
            eq(activityEvents.action, action),
          )
        : eq(activityEvents.organizationId, org.id),
    )
    .orderBy(asc(activityEvents.createdAt), asc(activityEvents.id));

  return rows;
}
