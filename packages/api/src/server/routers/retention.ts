import { and, asc, eq } from "@kyren/db/drizzle";
import { legalHolds, retentionPolicies } from "@kyren/db/schema";
import { z } from "zod";

import { currentMemberId } from "../chat";
import { retentionTypes } from "../retention";
import { permissionProcedure, router } from "../trpc";

const procedure = (audit?: string[]) =>
  permissionProcedure("admin.manage_retention", undefined, {
    module: "admin",
    audit,
  });

export const retentionRouter = router({
  /** The organization's retention policies and its legal hold, if any. */
  get: procedure().query(async ({ ctx }) => {
    const organizationId = ctx.activeOrganization.id;
    const policies = await ctx.db
      .select({
        dataType: retentionPolicies.dataType,
        days: retentionPolicies.days,
      })
      .from(retentionPolicies)
      .where(eq(retentionPolicies.organizationId, organizationId))
      .orderBy(asc(retentionPolicies.dataType));
    const [hold] = await ctx.db
      .select({ reason: legalHolds.reason, setAt: legalHolds.setAt })
      .from(legalHolds)
      .where(eq(legalHolds.organizationId, organizationId))
      .limit(1);

    return { policies, hold: hold ?? null };
  }),

  /** Keeps a kind of data for this many days, or, with `null`, forever. */
  setPolicy: procedure(["retention.policy_set"])
    .input(
      z.object({
        dataType: z.enum(retentionTypes),
        days: z.number().int().min(30).max(3650).nullable(),
      }),
    )
    .mutation(({ ctx, input }) =>
      ctx.db.transaction(async (tx) => {
        const organizationId = ctx.activeOrganization.id;

        if (input.days === null) {
          await tx
            .delete(retentionPolicies)
            .where(
              and(
                eq(retentionPolicies.organizationId, organizationId),
                eq(retentionPolicies.dataType, input.dataType),
              ),
            );
        } else {
          await tx
            .insert(retentionPolicies)
            .values({
              organizationId,
              dataType: input.dataType,
              days: input.days,
            })
            .onConflictDoUpdate({
              target: [
                retentionPolicies.organizationId,
                retentionPolicies.dataType,
              ],
              set: { days: input.days, updatedAt: new Date() },
            });
        }

        await ctx.audit.record(tx, {
          action: "retention.policy_set",
          target: { id: organizationId, label: input.dataType },
          metadata: { days: input.days },
        });

        return { ok: true };
      }),
    ),

  /** Places or lifts the legal hold. While it is on, nothing is purged or erased. */
  setHold: procedure(["retention.hold_set"])
    .input(
      z.object({
        on: z.boolean(),
        reason: z.string().trim().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.activeOrganization.id;
      const memberId = await currentMemberId(ctx);

      return ctx.db.transaction(async (tx) => {
        if (input.on) {
          const reason = input.reason?.trim() || "Legal hold";

          await tx
            .insert(legalHolds)
            .values({ organizationId, reason, setByMemberId: memberId })
            .onConflictDoUpdate({
              target: legalHolds.organizationId,
              set: { reason, setByMemberId: memberId, setAt: new Date() },
            });
        } else {
          await tx
            .delete(legalHolds)
            .where(eq(legalHolds.organizationId, organizationId));
        }

        await ctx.audit.record(tx, {
          action: "retention.hold_set",
          target: {
            id: organizationId,
            label: input.on ? "placed" : "lifted",
          },
          metadata: { reason: input.reason ?? null },
        });

        return { on: input.on };
      });
    }),
});
