import { TRPCError } from "@trpc/server";
import { auth } from "@zentro/auth";
import { and, asc, desc, eq, gte, lte } from "@zentro/db/drizzle";
import {
  activityEvents,
  employees,
  leaveRequests,
  members,
  roles,
  users,
} from "@zentro/db/schema";
import { z } from "zod";

import { assertHoldsAll } from "../../access";
import { awayUntilByMember } from "../../away";
import { callAuth } from "../../auth-calls";
import { permissionProcedure, router, type OrganizationContext } from "../../trpc";
import { isoDate } from "../../zod-common";

const memberIdSchema = z.object({ memberId: z.string().uuid() });

async function loadTargetMember(
  ctx: {
    db: typeof import("@zentro/db").db;
    activeOrganization: { id: string };
  },
  memberId: string,
) {
  const [target] = await ctx.db
    .select({ id: members.id, userId: members.userId, role: members.role })
    .from(members)
    .where(
      and(
        eq(members.id, memberId),
        eq(members.organizationId, ctx.activeOrganization.id),
      ),
    )
    .limit(1);

  if (!target) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Member not found." });
  }

  return target;
}

async function userLabel(
  ctx: { db: typeof import("@zentro/db").db },
  userId: string,
) {
  const [row] = await ctx.db
    .select({ name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return row ? row.name || row.email : null;
}

const isOwner = (role: string) =>
  role
    .split(",")
    .map((part) => part.trim())
    .includes("owner");

/** When the target is an admin, only an owner may act on them. */
async function assertOwnerForAdmin(
  ctx: OrganizationContext,
  targetRole: string,
  message: string,
) {
  const isAdmin = targetRole
    .split(",")
    .map((part) => part.trim())
    .includes("admin");

  if (!isAdmin) return;

  const caller = await ctx.permissions.snapshot();

  if (!caller.baseRole || !isOwner(caller.baseRole)) {
    throw new TRPCError({ code: "FORBIDDEN", message });
  }
}

export const memberQueriesProcedures = {
  getMembers: permissionProcedure("members.view").query(async ({ ctx }) => {
    const { activeOrganization, db } = ctx;

    return db
      .select({
        id: members.id,
        role: members.role,
        userId: users.id,
        name: users.name,
        email: users.email,
        image: users.image,
      })
      .from(members)
      .innerJoin(users, eq(users.id, members.userId))
      .where(eq(members.organizationId, activeOrganization.id))
      .orderBy(asc(users.name), asc(users.email));
  }),

  // Changes a member's base organization role (admin or member).
  getOutOfOffice: permissionProcedure("members.view").query(async ({ ctx }) => {
    const away = await awayUntilByMember(ctx.db, ctx.activeOrganization.id);

    return [...away].map(([memberId, untilDate]) => ({ memberId, untilDate }));
  }),

  toggleOutOfOffice: permissionProcedure("members.view", undefined, {
    audit: ["member.out_of_office"],
  })
    .input(
      z.object({
        memberId: z.string().uuid(),
        isOutOfOffice: z.boolean(),
        untilDate: isoDate.optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { db, activeOrganization, user } = ctx;
      const target = await loadTargetMember(ctx, input.memberId);

      // Your own status is yours to set; someone else's takes a manager.
      if (
        target.userId !== user.id &&
        !(await ctx.permissions.can("members.role.update"))
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only change your own out-of-office status.",
        });
      }

      const label = await userLabel(ctx, target.userId);

      await ctx.audit.record(db, {
        action: "member.out_of_office",
        target: { id: target.id, label },
        metadata: {
          isOutOfOffice: input.isOutOfOffice,
          untilDate: input.untilDate ?? null,
        },
      });

      return { memberId: target.id, isOutOfOffice: input.isOutOfOffice };
    }),
};
