import { TRPCError } from "@trpc/server";
import {
  and,
  count,
  desc,
  eq,
  gt,
  ilike,
  isNull,
  lte,
  or,
  sql,
} from "@kyren/db/drizzle";
import {
  jobs,
  organizations,
  platformAnnouncements,
  platformAuditEvents,
  platformIpAllowlist,
  platformSettings,
  users,
} from "@kyren/db/schema";
import { z } from "zod";

import { clientIp } from "../../client-ip";
import { isValidCidr } from "../../ip-policy";
import { recordPlatformAudit } from "../../platform-audit";
import {
  forgetMaintenance,
  forgetPlatformIpPolicy,
  maintenanceState,
} from "../../platform-policy";
import { ipMatches } from "../../ip-policy";
import { platformProcedure, router } from "../../trpc";

const idInput = z.object({ id: z.string().uuid() });


export const platformMaintenanceRouter = router({
  get: platformProcedure.query(({ ctx }) => maintenanceState(ctx.db)),

  /** While on, every change anywhere in Kyren is refused; reads keep working. */
  set: platformProcedure
    .input(
      z.object({
        enabled: z.boolean(),
        message: z.string().trim().max(500).default(""),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .insert(platformSettings)
        .values({
          key: "maintenance",
          value: { enabled: input.enabled, message: input.message },
        })
        .onConflictDoUpdate({
          target: platformSettings.key,
          set: {
            value: { enabled: input.enabled, message: input.message },
            updatedAt: new Date(),
          },
        });
      forgetMaintenance();
      await recordPlatformAudit(ctx, {
        action: input.enabled ? "maintenance.enabled" : "maintenance.disabled",
        targetType: "platform",
        label: "Maintenance mode",
        detail: { message: input.message },
      });

      return { enabled: input.enabled, message: input.message };
    }),
});

export const platformIpRouter = router({
  list: platformProcedure.query(async ({ ctx }) => ({
    rules: await ctx.db
      .select()
      .from(platformIpAllowlist)
      .orderBy(platformIpAllowlist.createdAt),
    yourAddress: clientIp(ctx.headers),
  })),

  add: platformProcedure
    .input(
      z.object({
        cidr: z.string().trim().min(2).max(60),
        label: z.string().trim().max(80).default(""),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!isValidCidr(input.cidr)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "That is not an address or range, such as 203.0.113.0/24.",
        });
      }

      const existing = await ctx.db.select().from(platformIpAllowlist);
      const mine = clientIp(ctx.headers);

      // The first rule switches the list on; it must still let this caller in.
      if (!existing.length && !(mine && ipMatches(mine, input.cidr))) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: mine
            ? `Your address (${mine}) is not in that range, so you would lock yourself out.`
            : "Your address could not be determined, so the list cannot be turned on safely.",
        });
      }

      const [rule] = await ctx.db
        .insert(platformIpAllowlist)
        .values({ cidr: input.cidr, label: input.label })
        .returning();

      forgetPlatformIpPolicy();
      await recordPlatformAudit(ctx, {
        action: "platform_ip.added",
        targetType: "platform_ip",
        targetId: rule!.id,
        label: input.cidr,
      });

      return rule!;
    }),

  remove: platformProcedure.input(idInput).mutation(async ({ ctx, input }) => {
    const rules = await ctx.db.select().from(platformIpAllowlist);
    const rule = rules.find((row) => row.id === input.id);

    if (!rule) {
      throw new TRPCError({ code: "NOT_FOUND", message: "No such rule." });
    }

    const rest = rules.filter((row) => row.id !== input.id);
    const mine = clientIp(ctx.headers);

    if (
      rest.length &&
      !(mine && rest.some((row) => ipMatches(mine, row.cidr)))
    ) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Removing that rule would lock you out.",
      });
    }

    await ctx.db
      .delete(platformIpAllowlist)
      .where(eq(platformIpAllowlist.id, input.id));
    forgetPlatformIpPolicy();
    await recordPlatformAudit(ctx, {
      action: "platform_ip.removed",
      targetType: "platform_ip",
      targetId: input.id,
      label: rule.cidr,
    });

    return { id: input.id };
  }),
});

export const platformAnnouncementsRouter = router({
  list: platformProcedure.query(({ ctx }) =>
    ctx.db
      .select()
      .from(platformAnnouncements)
      .orderBy(desc(platformAnnouncements.createdAt))
      .limit(100),
  ),

  create: platformProcedure
    .input(
      z.object({
        title: z.string().trim().min(1).max(120),
        body: z.string().trim().max(1000).default(""),
        severity: z.enum(["info", "warning", "critical"]).default("info"),
        startsAt: z.coerce.date().optional(),
        endsAt: z.coerce.date().nullable().default(null),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const startsAt = input.startsAt ?? new Date();

      if (input.endsAt && input.endsAt <= startsAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "It has to end after it starts.",
        });
      }

      const [row] = await ctx.db
        .insert(platformAnnouncements)
        .values({
          title: input.title,
          body: input.body,
          severity: input.severity,
          startsAt,
          endsAt: input.endsAt,
        })
        .returning();

      await recordPlatformAudit(ctx, {
        action: "announcement.created",
        targetType: "announcement",
        targetId: row!.id,
        label: input.title,
        detail: { severity: input.severity },
      });

      return row!;
    }),

  withdraw: platformProcedure
    .input(idInput)
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .update(platformAnnouncements)
        .set({ withdrawnAt: new Date() })
        .where(eq(platformAnnouncements.id, input.id))
        .returning();

      if (!row) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No such announcement.",
        });
      }

      await recordPlatformAudit(ctx, {
        action: "announcement.withdrawn",
        targetType: "announcement",
        targetId: row.id,
        label: row.title,
      });

      return { id: row.id };
    }),
});

/** Announcements that are live right now (used by the workspace banner). */
export function liveAnnouncementsCondition(now = new Date()) {
  return and(
    isNull(platformAnnouncements.withdrawnAt),
    lte(platformAnnouncements.startsAt, now),
    or(
      isNull(platformAnnouncements.endsAt),
      gt(platformAnnouncements.endsAt, now),
    ),
  );
}

