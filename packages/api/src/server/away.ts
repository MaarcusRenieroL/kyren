import type { db as database } from "@zentro/db";
import { and, desc, eq, gte, lte } from "@zentro/db/drizzle";
import { activityEvents, employees, leaveRequests } from "@zentro/db/schema";

type Database = Pick<typeof database, "select">;

/**
 * Members who are away today, with the date they are back (`null` when open
 * ended): switched on out of office, or on approved leave. Only the return date
 * leaves HR; the leave type and note stay there.
 */
export async function awayUntilByMember(
  db: Database,
  organizationId: string,
): Promise<Map<string, string | null>> {
  const events = await db
    .select({
      targetId: activityEvents.targetId,
      metadata: activityEvents.metadata,
    })
    .from(activityEvents)
    .where(
      and(
        eq(activityEvents.organizationId, organizationId),
        eq(activityEvents.targetType, "member"),
        eq(activityEvents.action, "member.out_of_office"),
      ),
    )
    .orderBy(desc(activityEvents.createdAt));

  const latest = new Map<
    string,
    { isOutOfOffice: boolean; untilDate: string | null }
  >();

  for (const event of events) {
    if (latest.has(event.targetId)) continue;
    const meta = (event.metadata ?? {}) as Record<string, unknown>;

    latest.set(event.targetId, {
      isOutOfOffice: Boolean(meta.isOutOfOffice),
      untilDate: (meta.untilDate as string) || null,
    });
  }

  const away = new Map<string, string | null>();

  latest.forEach((value, memberId) => {
    if (value.isOutOfOffice) away.set(memberId, value.untilDate);
  });

  const today = new Date().toISOString().slice(0, 10);
  const onLeave = await db
    .select({ memberId: employees.memberId, endDate: leaveRequests.endDate })
    .from(leaveRequests)
    .innerJoin(employees, eq(employees.id, leaveRequests.employeeId))
    .where(
      and(
        eq(leaveRequests.organizationId, organizationId),
        eq(leaveRequests.status, "approved"),
        lte(leaveRequests.startDate, today),
        gte(leaveRequests.endDate, today),
      ),
    );

  for (const leave of onLeave) {
    if (!leave.memberId) continue;
    const existing = away.get(leave.memberId);

    if (!away.has(leave.memberId)) {
      away.set(leave.memberId, leave.endDate);
    } else if (!existing || existing < leave.endDate) {
      away.set(leave.memberId, leave.endDate);
    }
  }

  return away;
}
