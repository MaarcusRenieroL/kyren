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
} from "@zentro/db/drizzle";
import {
  jobs,
  organizations,
  platformAnnouncements,
  platformAuditEvents,
  platformIpAllowlist,
  platformSettings,
  users,
} from "@zentro/db/schema";
import { z } from "zod";

import { clientIp } from "../client-ip";
import { isValidCidr } from "../ip-policy";
import { recordPlatformAudit } from "../platform-audit";
import {
  forgetMaintenance,
  forgetPlatformIpPolicy,
  maintenanceState,
} from "../platform-policy";
import { ipMatches } from "../ip-policy";
import { platformProcedure, router } from "../trpc";

const idInput = z.object({ id: z.string().uuid() });

export const platformMaintenanceRouter = router({
  get: platformProcedure.query(({ ctx }) => maintenanceState(ctx.db)),

  /** While on, every change anywhere in Zentro is refused; reads keep working. */
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

export const platformHealthRouter = router({
  overview: platformProcedure.query(async ({ ctx }) => {
    const started = Date.now();

    await ctx.db.execute(sql`select 1`);

    const databaseMs = Date.now() - started;
    const byKind = await ctx.db
      .select({
        kind: jobs.kind,
        status: jobs.status,
        total: count(),
        oldest: sql<Date | null>`min(${jobs.runAt})`,
      })
      .from(jobs)
      .groupBy(jobs.kind, jobs.status)
      .orderBy(jobs.kind);
    const dead = await ctx.db
      .select()
      .from(jobs)
      .where(eq(jobs.status, "dead"))
      .orderBy(desc(jobs.createdAt))
      .limit(50);
    const [tenants] = await ctx.db
      .select({
        total: count(),
        suspended: sql<number>`count(${organizations.suspendedAt})::int`,
      })
      .from(organizations);
    const [people] = await ctx.db.select({ total: count() }).from(users);

    return {
      databaseMs,
      jobs: byKind,
      dead: dead.map((job) => ({
        id: job.id,
        kind: job.kind,
        attempts: job.attempts,
        lastError: job.lastError,
        createdAt: job.createdAt,
      })),
      tenants: tenants?.total ?? 0,
      suspendedTenants: tenants?.suspended ?? 0,
      users: people?.total ?? 0,
    };
  }),

  retryJob: platformProcedure
    .input(idInput)
    .mutation(async ({ ctx, input }) => {
      const [job] = await ctx.db
        .update(jobs)
        .set({ status: "pending", attempts: 0, runAt: new Date() })
        .where(and(eq(jobs.id, input.id), eq(jobs.status, "dead")))
        .returning({ id: jobs.id, kind: jobs.kind });

      if (!job) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No such failed job.",
        });
      }

      await recordPlatformAudit(ctx, {
        action: "job.retried",
        targetType: "job",
        targetId: job.id,
        label: job.kind,
      });

      return job;
    }),

  discardJob: platformProcedure
    .input(idInput)
    .mutation(async ({ ctx, input }) => {
      const [job] = await ctx.db
        .delete(jobs)
        .where(and(eq(jobs.id, input.id), eq(jobs.status, "dead")))
        .returning({ id: jobs.id, kind: jobs.kind });

      if (!job) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No such failed job.",
        });
      }

      await recordPlatformAudit(ctx, {
        action: "job.discarded",
        targetType: "job",
        targetId: job.id,
        label: job.kind,
      });

      return job;
    }),
});

export const platformAuditRouter = router({
  list: platformProcedure
    .input(
      z.object({
        organizationId: z.string().uuid().optional(),
        search: z.string().trim().max(100).optional(),
        page: z.number().int().min(1).max(10_000).default(1),
      }),
    )
    .query(async ({ ctx, input }) => {
      const pageSize = 50;
      const term = input.search?.replace(/[%_\\]/g, "\\$&");
      const where = and(
        input.organizationId
          ? eq(platformAuditEvents.organizationId, input.organizationId)
          : undefined,
        term
          ? or(
              ilike(platformAuditEvents.action, `%${term}%`),
              ilike(platformAuditEvents.actorEmail, `%${term}%`),
              ilike(platformAuditEvents.label, `%${term}%`),
            )
          : undefined,
      );
      const [rows, total] = await Promise.all([
        ctx.db
          .select()
          .from(platformAuditEvents)
          .where(where)
          .orderBy(desc(platformAuditEvents.createdAt))
          .limit(pageSize)
          .offset((input.page - 1) * pageSize),
        ctx.db
          .select({ value: count() })
          .from(platformAuditEvents)
          .where(where),
      ]);

      return { rows, total: total[0]?.value ?? 0, page: input.page, pageSize };
    }),
});
