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

import { assertHoldsAll } from "../access";
import { awayUntilByMember } from "../away";
import { callAuth } from "../auth-calls";
import { permissionProcedure, router } from "../trpc";
import { isoDate } from "../zod-common";

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

export const memberRouter = router({
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
  updateRole: permissionProcedure("members.role.update", undefined, {
    audit: ["member.role_updated"],
  })
    .input(memberIdSchema.extend({ role: z.enum(["admin", "member"]) }))
    .mutation(async ({ ctx, input }) => {
      const { db, user, activeOrganization } = ctx;
      const target = await loadTargetMember(ctx, input.memberId);

      if (isOwner(target.role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "An owner's role can only change through an ownership transfer.",
        });
      }

      if (target.userId === user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You cannot change your own role.",
        });
      }

      // Admins don't demote or promote each other; an owner does.
      if (target.role.split(",").includes("admin")) {
        const [self] = await db
          .select({ role: members.role })
          .from(members)
          .where(
            and(
              eq(members.organizationId, activeOrganization.id),
              eq(members.userId, user.id),
            ),
          )
          .limit(1);

        if (!self || !isOwner(self.role)) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Only an owner can change another admin's role.",
          });
        }
      }

      // Promoting someone to a role is giving them everything it grants.
      const [role] = await db
        .select({ permissions: roles.permissions })
        .from(roles)
        .where(
          and(
            eq(roles.organizationId, activeOrganization.id),
            eq(roles.systemKey, input.role),
          ),
        )
        .limit(1);

      await assertHoldsAll(ctx.permissions, role?.permissions ?? []);

      await callAuth(() =>
        auth.api.updateMemberRole({
          headers: ctx.headers,
          body: {
            memberId: target.id,
            role: input.role,
            organizationId: activeOrganization.id,
          },
        }),
      );

      await ctx.audit.record(db, {
        action: "member.role_updated",
        target: { id: target.id, label: await userLabel(ctx, target.userId) },
        changes: [{ field: "role", from: target.role, to: input.role }],
        metadata: {
          userId: target.userId,
          before: { role: target.role },
          after: { role: input.role },
        },
      });

      return { memberId: target.id, role: input.role };
    }),

  remove: permissionProcedure("members.remove", undefined, {
    audit: ["member.removed"],
  })
    .input(memberIdSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, user, activeOrganization } = ctx;
      const target = await loadTargetMember(ctx, input.memberId);

      if (isOwner(target.role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "An owner cannot be removed.",
        });
      }

      if (target.userId === user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Leave the organization instead of removing yourself.",
        });
      }

      const label = await userLabel(ctx, target.userId);

      await callAuth(() =>
        auth.api.removeMember({
          headers: ctx.headers,
          body: {
            memberIdOrEmail: target.id,
            organizationId: activeOrganization.id,
          },
        }),
      );

      await ctx.audit.record(db, {
        action: "member.removed",
        target: { id: target.id, label },
        metadata: {
          userId: target.userId,
          before: { userId: target.userId, role: target.role },
        },
      });

      return { memberId: target.id };
    }),

  // Owner only: the target becomes an owner and the caller steps down to admin.
  transferOwnership: permissionProcedure("org.ownership.transfer", undefined, {
    audit: ["org.ownership_transferred"],
    fresh: true,
  })
    .input(memberIdSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, user, activeOrganization } = ctx;
      const target = await loadTargetMember(ctx, input.memberId);

      if (target.userId === user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You already own this organization.",
        });
      }

      const label = await userLabel(ctx, target.userId);

      await db.transaction(async (tx) => {
        // Step down first, and only while still the owner: a second transfer
        // submitted at the same moment finds nothing to demote and stops.
        const stepped = await tx
          .update(members)
          .set({ role: "admin" })
          .where(
            and(
              eq(members.userId, user.id),
              eq(members.organizationId, activeOrganization.id),
              eq(members.role, "owner"),
            ),
          )
          .returning({ id: members.id });

        if (!stepped.length) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Ownership has already been transferred.",
          });
        }

        await tx
          .update(members)
          .set({ role: "owner" })
          .where(eq(members.id, target.id));

        await ctx.audit.record(tx, {
          action: "org.ownership_transferred",
          target: { id: target.id, label },
          metadata: {
            userId: target.userId,
            before: { ownerUserId: user.id },
            after: { ownerUserId: target.userId },
          },
        });
      });

      return { memberId: target.id };
    }),

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
});
