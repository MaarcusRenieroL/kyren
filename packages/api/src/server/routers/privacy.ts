import { TRPCError } from "@trpc/server";
import { and, eq } from "@zentro/db/drizzle";
import { members, users } from "@zentro/db/schema";
import { z } from "zod";

import { currentMemberId } from "../chat";
import { eraseMember, exportMemberData } from "../privacy";
import {
  permissionProcedure,
  protectedProcedure,
  router,
  type OrganizationContext,
} from "../trpc";

const procedure = (audit?: string[]) =>
  permissionProcedure("admin.manage_privacy", undefined, {
    module: "admin",
    audit,
  });

const memberLabel = async (ctx: OrganizationContext, memberId: string) => {
  const [row] = await ctx.db
    .select({ name: users.name })
    .from(members)
    .innerJoin(users, eq(users.id, members.userId))
    .where(
      and(
        eq(members.id, memberId),
        eq(members.organizationId, ctx.activeOrganization.id),
      ),
    )
    .limit(1);

  if (!row) throw new TRPCError({ code: "NOT_FOUND" });

  return row.name;
};

export const privacyRouter = router({
  /** A person's own data in the active organization. */
  exportMine: protectedProcedure.query(async ({ ctx }) =>
    exportMemberData(ctx.db, {
      organizationId: ctx.activeOrganization!.id,
      memberId: await currentMemberId(ctx as OrganizationContext),
    }),
  ),

  /** An administrator's export of one member's data. */
  exportMember: procedure(["privacy.exported"])
    .input(z.object({ memberId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const label = await memberLabel(ctx, input.memberId);
      const data = await exportMemberData(ctx.db, {
        organizationId: ctx.activeOrganization.id,
        memberId: input.memberId,
      });

      await ctx.audit.record(ctx.db, {
        action: "privacy.exported",
        target: { id: input.memberId, label },
      });

      return data;
    }),

  /** An administrator removes a member and their personal data. */
  erase: procedure(["privacy.erased"])
    .input(
      z.object({
        memberId: z.string().uuid(),
        redactContent: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const label = await memberLabel(ctx, input.memberId);
      const result = await eraseMember(ctx.db, {
        organizationId: ctx.activeOrganization.id,
        memberId: input.memberId,
        redactContent: input.redactContent,
      });

      await ctx.audit.record(ctx.db, {
        action: "privacy.erased",
        target: { id: input.memberId, label },
        metadata: {
          redactContent: input.redactContent,
          accountErased: result.accountErased,
        },
      });

      return result;
    }),

  /** A person asks to be erased. They must type their own email to confirm. */
  eraseMine: protectedProcedure
    .meta({ audit: ["privacy.erased"] })
    .input(z.object({ confirmEmail: z.string().trim().max(320) }))
    .mutation(async ({ ctx, input }) => {
      if (input.confirmEmail.toLowerCase() !== ctx.user.email.toLowerCase()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Type your email address to confirm.",
        });
      }

      const memberId = await currentMemberId(ctx as OrganizationContext);
      const result = await eraseMember(ctx.db, {
        organizationId: ctx.activeOrganization!.id,
        memberId,
        redactContent: false,
      });

      await ctx.audit.record(ctx.db, {
        action: "privacy.erased",
        target: { id: memberId, label: "themselves" },
        metadata: { accountErased: result.accountErased },
      });

      return result;
    }),
});
