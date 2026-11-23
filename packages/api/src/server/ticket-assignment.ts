import { and, eq, inArray, sql } from "@kyren/db/drizzle";
import { members, ticketAssignmentRules, tickets } from "@kyren/db/schema";

import type { DbHandle } from "./access";
import { awayUntilByMember } from "./away";
import { createPermissionContext } from "./permissions";

type Tx = DbHandle & {
  execute: (query: ReturnType<typeof sql>) => Promise<unknown>;
};

/**
 * The person the next ticket from the public desk goes to, or null when
 * automatic assignment is off or nobody in the rotation is in. Takes turns
 * after whoever got the last one (or, in "least_open" mode, picks whoever has
 * the fewest open tickets, turn order breaking ties), skips people who are away, have left the
 * organization or can no longer see tickets, and remembers who got this one. The rule's row
 * is locked for the transaction, so two tickets at once take two turns.
 */
export async function nextAssignee(tx: Tx, organizationId: string) {
  await tx.execute(
    sql`select 1 from ${ticketAssignmentRules} where ${ticketAssignmentRules.organizationId} = ${organizationId} for update`,
  );

  const [rule] = await tx
    .select()
    .from(ticketAssignmentRules)
    .where(eq(ticketAssignmentRules.organizationId, organizationId))
    .limit(1);

  if (!rule?.enabled || !rule.memberIds.length) return null;

  const current = new Map(
    (
      await tx
        .select({ id: members.id, userId: members.userId })
        .from(members)
        .where(
          and(
            eq(members.organizationId, organizationId),
            inArray(members.id, rule.memberIds),
          ),
        )
    ).map((row) => [row.id, row.userId]),
  );
  const away = await awayUntilByMember(tx, organizationId);
  const start = rule.lastMemberId
    ? rule.memberIds.indexOf(rule.lastMemberId) + 1
    : 0;
  // Everyone after the last pick, in turn order.
  const order = rule.memberIds.map(
    (_, step) => rule.memberIds[(start + step) % rule.memberIds.length]!,
  );
  const canTake = async (candidate: string) => {
    const userId = current.get(candidate);

    return Boolean(
      userId &&
      !away.has(candidate) &&
      (await createPermissionContext(tx as never, organizationId, userId).can(
        "tickets.view",
      )),
    );
  };
  let chosen: string | null = null;

  if (rule.mode === "least_open") {
    // Count first, then check people lightest first and stop at the first
    // who can take it, so a long rotation costs one query, not one per head.
    const load = new Map(
      (
        await tx
          .select({
            memberId: tickets.assigneeMemberId,
            open: sql<number>`count(*)`.mapWith(Number),
          })
          .from(tickets)
          .where(
            and(
              eq(tickets.organizationId, organizationId),
              inArray(tickets.status, ["open", "pending"]),
              inArray(tickets.assigneeMemberId, order),
            ),
          )
          .groupBy(tickets.assigneeMemberId)
      ).map((row) => [row.memberId, row.open]),
    );
    // A stable sort keeps turn order among equal loads.
    const lightestFirst = [...order].sort(
      (a, b) => (load.get(a) ?? 0) - (load.get(b) ?? 0),
    );

    for (const candidate of lightestFirst) {
      if (await canTake(candidate)) {
        chosen = candidate;
        break;
      }
    }
  } else {
    for (const candidate of order) {
      if (await canTake(candidate)) {
        chosen = candidate;
        break;
      }
    }
  }

  if (chosen) {
    await tx
      .update(ticketAssignmentRules)
      .set({ lastMemberId: chosen })
      .where(eq(ticketAssignmentRules.organizationId, organizationId));
  }

  return chosen;
}
