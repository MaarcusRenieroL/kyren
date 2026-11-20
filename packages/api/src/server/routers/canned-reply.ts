import { TRPCError } from "@trpc/server";
import { and, asc, eq } from "@zentro/db/drizzle";
import { cannedReplies } from "@zentro/db/schema";
import { z } from "zod";

import { currentMemberId } from "../chat";
import { permissionProcedure, router } from "../trpc";

const procedure = (permission: string, audit?: string[]) =>
  permissionProcedure(permission, undefined, { module: "tickets", audit });

const replyInput = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1, "Give the reply a title.").max(120),
  body: z.string().trim().min(1, "Write the reply.").max(10_000),
});

/** Saved answers agents insert into ticket replies. */
export const cannedReplyRouter = router({
  /** Every saved reply, for anyone who answers tickets. */
  list: procedure("tickets.reply").query(({ ctx }) =>
    ctx.db
      .select({
        id: cannedReplies.id,
        title: cannedReplies.title,
        body: cannedReplies.body,
      })
      .from(cannedReplies)
      .where(eq(cannedReplies.organizationId, ctx.activeOrganization.id))
      .orderBy(asc(cannedReplies.title)),
  ),

  save: procedure("tickets.manage_inbox", ["ticket.canned_reply_saved"])
    .input(replyInput)
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.activeOrganization.id;
      const memberId = await currentMemberId(ctx);

      return ctx.db.transaction(async (tx) => {
        const [row] = input.id
          ? await tx
              .update(cannedReplies)
              .set({
                title: input.title,
                body: input.body,
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(cannedReplies.id, input.id),
                  eq(cannedReplies.organizationId, organizationId),
                ),
              )
              .returning({ id: cannedReplies.id })
          : await tx
              .insert(cannedReplies)
              .values({
                organizationId,
                title: input.title,
                body: input.body,
                createdByMemberId: memberId,
              })
              .returning({ id: cannedReplies.id });

        if (!row) throw new TRPCError({ code: "NOT_FOUND" });

        await ctx.audit.record(tx, {
          action: "ticket.canned_reply_saved",
          target: { id: row.id, label: input.title },
        });

        return row;
      });
    }),

  remove: procedure("tickets.manage_inbox", ["ticket.canned_reply_deleted"])
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) =>
      ctx.db.transaction(async (tx) => {
        const [row] = await tx
          .delete(cannedReplies)
          .where(
            and(
              eq(cannedReplies.id, input.id),
              eq(cannedReplies.organizationId, ctx.activeOrganization.id),
            ),
          )
          .returning({ id: cannedReplies.id, title: cannedReplies.title });

        if (!row) throw new TRPCError({ code: "NOT_FOUND" });

        await ctx.audit.record(tx, {
          action: "ticket.canned_reply_deleted",
          target: { id: row.id, label: row.title },
        });

        return { ok: true };
      }),
    ),
});
