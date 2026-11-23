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
