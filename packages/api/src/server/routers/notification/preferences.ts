import { and, eq } from "@zentro/db/drizzle";
import {
  notificationPreferences,
  notificationReads,
} from "@zentro/db/schema";
import { z } from "zod";
import { protectedProcedure } from "../../trpc";
import { mutedKindsFor, preferenceKinds } from "./types";

export const notificationPreferencesProcedures = {
  getPreferences: protectedProcedure.query(async ({ ctx }) => ({
    mutedKinds: await mutedKindsFor(ctx),
  })),

  setPreferences: protectedProcedure
    .input(z.object({ mutedKinds: z.array(z.enum(preferenceKinds)).max(10) }))
    .mutation(async ({ ctx, input }) => {
      const mutedKinds = [...new Set(input.mutedKinds)];

      await ctx.db
        .insert(notificationPreferences)
        .values({
          organizationId: ctx.activeOrganization.id,
          userId: ctx.user.id,
          mutedKinds,
        })
        .onConflictDoUpdate({
          target: [
            notificationPreferences.organizationId,
            notificationPreferences.userId,
          ],
          set: { mutedKinds, updatedAt: new Date() },
        });

      return { mutedKinds };
    }),

  markRead: protectedProcedure
    .input(z.object({ id: z.string().min(1).max(120) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .insert(notificationReads)
        .values({
          organizationId: ctx.activeOrganization.id,
          userId: ctx.user.id,
          itemKey: input.id,
        })
        .onConflictDoNothing();

      return { ok: true };
    }),

  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    const { db, activeOrganization, user } = ctx;
    const scope = and(
      eq(notificationReads.organizationId, activeOrganization.id),
      eq(notificationReads.userId, user.id),
    );

    // One "everything until now" mark replaces the single ones.
    await db.transaction(async (tx) => {
      await tx.delete(notificationReads).where(scope);
      await tx.insert(notificationReads).values({
        organizationId: activeOrganization.id,
        userId: user.id,
        itemKey: "*",
      });
    });

    return { ok: true };
  }),
};
