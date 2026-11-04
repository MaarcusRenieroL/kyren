import { TRPCError } from "@trpc/server";
import { auth } from "@zentro/auth";
import { and, count, desc, eq } from "@zentro/db/drizzle";
import { invitations, members, roles, users } from "@zentro/db/schema";
import { z } from "zod";

import { assertHoldsAll } from "../access";
import { callAuth } from "../auth-calls";
import { organizationLimits } from "../platform-policy";
import { permissionProcedure, router } from "../trpc";

const invitationIdSchema = z.object({ invitationId: z.string().uuid() });

export const invitationRouter = router({
  list: permissionProcedure("invitations.view").query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: invitations.id,
        email: invitations.email,
        role: invitations.role,
        status: invitations.status,
        expiresAt: invitations.expiresAt,
        createdAt: invitations.createdAt,
        inviterName: users.name,
      })
      .from(invitations)
      .leftJoin(users, eq(users.id, invitations.inviterId))
      .where(eq(invitations.organizationId, ctx.activeOrganization.id))
      .orderBy(desc(invitations.createdAt));
  }),

  invite: permissionProcedure("members.invite", undefined, {
    audit: ["invitation.sent"],
  })
    .input(
      z.object({
        email: z.string().trim().email(),
        role: z.enum(["admin", "member"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { db, user, activeOrganization } = ctx;

      // Inviting someone as admin hands them everything admins can do.
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

      // A seat ceiling set by a platform operator counts members and open invitations.
      const { members: seats } = await organizationLimits(
        db,
        activeOrganization.id,
      );

      if (seats) {
        const [joined] = await db
          .select({ value: count() })
          .from(members)
          .where(eq(members.organizationId, activeOrganization.id));
        const [waiting] = await db
          .select({ value: count() })
          .from(invitations)
          .where(
            and(
              eq(invitations.organizationId, activeOrganization.id),
              eq(invitations.status, "pending"),
            ),
          );

        if ((joined?.value ?? 0) + (waiting?.value ?? 0) >= seats) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `Your plan allows ${seats} members. Contact support to add more.`,
          });
        }
      }

      const invitation = await callAuth(() =>
        auth.api.createInvitation({
          headers: ctx.headers,
          body: {
            email: input.email,
            role: input.role,
            organizationId: activeOrganization.id,
          },
        }),
      );

      await ctx.audit.record(db, {
        action: "invitation.sent",
        target: { id: invitation.id, label: input.email },
        metadata: { role: input.role },
      });

      return invitation;
    }),

  resend: permissionProcedure("invitations.resend", undefined, {
    audit: ["invitation.resent"],
  })
    .input(invitationIdSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, activeOrganization } = ctx;
      const [invitation] = await db
        .select()
        .from(invitations)
        .where(
          and(
            eq(invitations.id, input.invitationId),
            eq(invitations.organizationId, activeOrganization.id),
          ),
        )
        .limit(1);

      if (!invitation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invitation not found.",
        });
      }

      const resent = await callAuth(() =>
        auth.api.createInvitation({
          headers: ctx.headers,
          body: {
            email: invitation.email,
            role: invitation.role as "admin" | "member",
            organizationId: activeOrganization.id,
            resend: true,
          },
        }),
      );

      await ctx.audit.record(db, {
        action: "invitation.resent",
        target: { id: invitation.id, label: invitation.email },
        metadata: { role: invitation.role },
      });

      return resent;
    }),

  cancel: permissionProcedure("invitations.cancel", undefined, {
    audit: ["invitation.cancelled"],
  })
    .input(invitationIdSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, user, activeOrganization } = ctx;
      const [invitation] = await db
        .select({ id: invitations.id, email: invitations.email })
        .from(invitations)
        .where(
          and(
            eq(invitations.id, input.invitationId),
            eq(invitations.organizationId, activeOrganization.id),
          ),
        )
        .limit(1);

      if (!invitation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invitation not found.",
        });
      }

      await callAuth(() =>
        auth.api.cancelInvitation({
          headers: ctx.headers,
          body: { invitationId: invitation.id },
        }),
      );

      await ctx.audit.record(db, {
        action: "invitation.cancelled",
        target: { id: invitation.id, label: invitation.email },
      });

      return { invitationId: invitation.id };
    }),
});
