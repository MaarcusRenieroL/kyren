import { TRPCError } from "@trpc/server";
import { and, eq, isNull, ne, or, sql } from "@kyren/db/drizzle";
import {
  accounts,
  apiKeys,
  chatMessages,
  docComments,
  docs,
  employees,
  leaveRequests,
  meetingAttendees,
  members,
  sessions,
  taskComments,
  taskTimeLogs,
  tasks,
  ticketMessages,
  tickets,
  twoFactors,
  users,
  verifications,
} from "@kyren/db/schema";
import type { db as database } from "@kyren/db";
import { removeMemberAccess } from "@kyren/auth";
import { isUnderHold } from "../retention";

type Db = typeof database;
const REMOVED = "[removed]";

/**
 * Removes a person from an organization. What they wrote stays, no longer
 * linked to them, unless `redactContent` blanks it too. When this was their
 * last organization the account itself is anonymised and every way to sign in
 * is removed. Payroll amounts are kept: they are records the employer must
 * keep, and they no longer point at a person.
 */
export async function eraseMember(
  db: Db,
  input: {
    organizationId: string;
    memberId: string;
    redactContent: boolean;
  },
) {
  const { organizationId, memberId } = input;

  if (await isUnderHold(db, organizationId)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "A legal hold is on, so nobody can be erased until it is lifted.",
    });
  }

  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({
        userId: members.userId,
        role: members.role,
        email: users.email,
      })
      .from(members)
      .innerJoin(users, eq(users.id, members.userId))
      .where(
        and(
          eq(members.id, memberId),
          eq(members.organizationId, organizationId),
        ),
      )
      .limit(1);

    if (!row) throw new TRPCError({ code: "NOT_FOUND" });

    const isOwner = row.role.split(",").includes("owner");

    if (isOwner) {
      const otherOwners = await tx
        .select({ id: members.id })
        .from(members)
        .where(
          and(
            eq(members.organizationId, organizationId),
            or(
              eq(members.role, "owner"),
              sql`'owner' = any(string_to_array(${members.role}, ','))`,
            ),
            ne(members.id, memberId),
          ),
        )
        .limit(1);

      if (!otherOwners.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Make someone else an owner first.",
        });
      }
    }

    if (input.redactContent) {
      await tx
        .update(taskComments)
        .set({ body: REMOVED })
        .where(eq(taskComments.authorMemberId, memberId));
      await tx
        .update(docComments)
        .set({ body: REMOVED })
        .where(eq(docComments.authorMemberId, memberId));
      await tx
        .update(ticketMessages)
        .set({ body: REMOVED })
        .where(eq(ticketMessages.authorMemberId, memberId));
      await tx
        .update(chatMessages)
        .set({ body: REMOVED })
        .where(
          and(
            eq(chatMessages.authorMemberId, memberId),
            eq(chatMessages.kind, "message"),
          ),
        );
    }

    const employeeRows = await tx
      .select({ id: employees.id })
      .from(employees)
      .where(eq(employees.memberId, memberId));

    for (const employee of employeeRows) {
      await tx
        .update(employees)
        .set({
          name: "Former employee",
          email: null,
          location: null,
          department: null,
          jobTitle: "",
          status: "former",
        })
        .where(eq(employees.id, employee.id));
      await tx
        .update(leaveRequests)
        .set({ note: null })
        .where(eq(leaveRequests.employeeId, employee.id));
    }

    // Roles, overrides, teams and API keys given in this organization go
    // too, or they would come back if the person were invited again.
    await removeMemberAccess(
      tx as unknown as Parameters<typeof removeMemberAccess>[0],
      organizationId,
      row.userId,
    );
    await tx.delete(members).where(eq(members.id, memberId));

    const stillMember = await tx
      .select({ id: members.id })
      .from(members)
      .where(eq(members.userId, row.userId))
      .limit(1);

    if (stillMember.length) return { accountErased: false };

    await tx
      .update(apiKeys)
      .set({ revokedAt: new Date() })
      .where(
        and(eq(apiKeys.createdByUserId, row.userId), isNull(apiKeys.revokedAt)),
      );
    await tx.delete(sessions).where(eq(sessions.userId, row.userId));
    await tx.delete(accounts).where(eq(accounts.userId, row.userId));
    await tx.delete(twoFactors).where(eq(twoFactors.userId, row.userId));
    await tx
      .delete(verifications)
      .where(eq(verifications.identifier, row.email));
    await tx
      .update(users)
      .set({
        name: "Deleted user",
        email: `deleted-${row.userId}@deleted.invalid`,
        image: null,
        emailVerified: false,
        twoFactorEnabled: false,
        updatedAt: new Date(),
      })
      .where(eq(users.id, row.userId));

    return { accountErased: true };
  });
}
