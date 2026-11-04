import { TRPCError } from "@trpc/server";
import {
  and,
  count,
  desc,
  eq,
  ilike,
  isNotNull,
  isNull,
  or,
  sql,
  sum,
} from "@zentro/db/drizzle";
import {
  activityEvents,
  files,
  invitations,
  members,
  organizationModules,
  organizations,
  platformAuditEvents,
  projects,
  tasks,
  users,
} from "@zentro/db/schema";
import type { db as Database } from "@zentro/db";
import { z } from "zod";

import { recordPlatformAudit } from "../platform-audit";
import { forgetOrganizationStatus } from "../platform-policy";
import { platformProcedure, router } from "../trpc";

/** How long a deleted organization can still be brought back. */
export const DELETION_GRACE_DAYS = 14;
export const DELETION_REASON = "Scheduled for deletion";

const idInput = z.object({ id: z.string().uuid() });
const reasonText = z.string().trim().min(3).max(300);
const flagName = z.string().regex(/^[a-z][a-z0-9_.-]{0,39}$/);

// Tables that hold secrets stay out of an export.
const exportSkips =
  /api_?key|webhook|secret|token|session|account|verification/i;

async function findOrganization(db: typeof Database, id: string) {
  const [organization] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, id))
    .limit(1);

  if (!organization) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "No such organization.",
    });
  }

  return organization;
}

export const platformTenantsRouter = router({
  /** The directory: every organization, newest first, with a search and a status filter. */
  list: platformProcedure
    .input(
      z.object({
        search: z.string().trim().max(100).optional(),
        status: z
          .enum(["all", "active", "suspended", "deleting"])
          .default("all"),
        page: z.number().int().min(1).max(10_000).default(1),
      }),
    )
    .query(async ({ ctx, input }) => {
      const pageSize = 25;
      const term = input.search?.replace(/[%_\\]/g, "\\$&");
      const where = and(
        term
          ? or(
              ilike(organizations.name, `%${term}%`),
              ilike(organizations.slug, `%${term}%`),
            )
          : undefined,
        input.status === "active"
          ? isNull(organizations.suspendedAt)
          : undefined,
        input.status === "suspended"
          ? and(
              isNotNull(organizations.suspendedAt),
              isNull(organizations.deletionScheduledFor),
            )
          : undefined,
        input.status === "deleting"
          ? isNotNull(organizations.deletionScheduledFor)
          : undefined,
      );
      const [rows, total] = await Promise.all([
        ctx.db
          .select({
            id: organizations.id,
            name: organizations.name,
            slug: organizations.slug,
            createdAt: organizations.createdAt,
            suspendedAt: organizations.suspendedAt,
            deletionScheduledFor: organizations.deletionScheduledFor,
            members: sql<number>`(select count(*)::int from ${members} where ${members.organizationId} = "organization"."id")`,
          })
          .from(organizations)
          .where(where)
          .orderBy(desc(organizations.createdAt))
          .limit(pageSize)
          .offset((input.page - 1) * pageSize),
        ctx.db.select({ value: count() }).from(organizations).where(where),
      ]);

      return {
        rows,
        total: total[0]?.value ?? 0,
        page: input.page,
        pageSize,
      };
    }),

  get: platformProcedure.input(idInput).query(async ({ ctx, input }) => {
    const organization = await findOrganization(ctx.db, input.id);
    const one = async <T>(query: Promise<T[]>) => (await query)[0];
    const [memberRow, projectRow, taskRow, fileRow] = await Promise.all([
      one(
        ctx.db
          .select({ value: count() })
          .from(members)
          .where(eq(members.organizationId, input.id)),
      ),
      one(
        ctx.db
          .select({ value: count() })
          .from(projects)
          .where(eq(projects.organizationId, input.id)),
      ),
      one(
        ctx.db
          .select({ value: count() })
          .from(tasks)
          .where(eq(tasks.organizationId, input.id)),
      ),
      one(
        ctx.db
          .select({ bytes: sum(files.size), value: count() })
          .from(files)
          .where(eq(files.organizationId, input.id)),
      ),
    ]);
    const owners = await ctx.db
      .select({ name: users.name, email: users.email })
      .from(members)
      .innerJoin(users, eq(users.id, members.userId))
      .where(
        and(eq(members.organizationId, input.id), eq(members.role, "owner")),
      );
    const history = await ctx.db
      .select()
      .from(platformAuditEvents)
      .where(eq(platformAuditEvents.organizationId, input.id))
      .orderBy(desc(platformAuditEvents.createdAt))
      .limit(15);

    return {
      organization,
      owners,
      history,
      usage: {
        members: memberRow?.value ?? 0,
        projects: projectRow?.value ?? 0,
        tasks: taskRow?.value ?? 0,
        files: fileRow?.value ?? 0,
        storageBytes: Number(fileRow?.bytes ?? 0),
      },
    };
  }),

  suspend: platformProcedure
    .input(idInput.extend({ reason: reasonText }))
    .mutation(async ({ ctx, input }) => {
      const organization = await findOrganization(ctx.db, input.id);

      if (organization.deletionScheduledFor) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Deletion is scheduled; cancel it first.",
        });
      }

      await ctx.db
        .update(organizations)
        .set({ suspendedAt: new Date(), suspendedReason: input.reason })
        .where(eq(organizations.id, input.id));
      forgetOrganizationStatus(input.id);
      await recordPlatformAudit(ctx, {
        action: "tenant.suspended",
        organizationId: input.id,
        targetType: "organization",
        targetId: input.id,
        label: organization.name,
        detail: { reason: input.reason },
      });

      return { id: input.id };
    }),

  reactivate: platformProcedure
    .input(idInput)
    .mutation(async ({ ctx, input }) => {
      const organization = await findOrganization(ctx.db, input.id);

      if (organization.deletionScheduledFor) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Deletion is scheduled; cancel it to reactivate.",
        });
      }

      await ctx.db
        .update(organizations)
        .set({ suspendedAt: null, suspendedReason: null })
        .where(eq(organizations.id, input.id));
      forgetOrganizationStatus(input.id);
      await recordPlatformAudit(ctx, {
        action: "tenant.reactivated",
        organizationId: input.id,
        targetType: "organization",
        targetId: input.id,
        label: organization.name,
      });

      return { id: input.id };
    }),

  /**
   * A read-only look inside an organization: who is in it, what it holds and
   * what happened lately. It changes nothing, needs a reason, and is logged.
   */
  inspect: platformProcedure
    .input(idInput.extend({ reason: reasonText }))
    .mutation(async ({ ctx, input }) => {
      const organization = await findOrganization(ctx.db, input.id);

      await recordPlatformAudit(ctx, {
        action: "tenant.inspected",
        organizationId: input.id,
        targetType: "organization",
        targetId: input.id,
        label: organization.name,
        detail: { reason: input.reason },
      });

      const [people, openInvitations, projectRows, modules, recent] =
        await Promise.all([
          ctx.db
            .select({
              name: users.name,
              email: users.email,
              role: members.role,
              joinedAt: members.createdAt,
            })
            .from(members)
            .innerJoin(users, eq(users.id, members.userId))
            .where(eq(members.organizationId, input.id))
            .orderBy(members.createdAt)
            .limit(200),
          ctx.db
            .select({ value: count() })
            .from(invitations)
            .where(
              and(
                eq(invitations.organizationId, input.id),
                eq(invitations.status, "pending"),
              ),
            ),
          ctx.db
            .select({
              id: projects.id,
              name: projects.name,
              status: projects.status,
            })
            .from(projects)
            .where(eq(projects.organizationId, input.id))
            .orderBy(desc(projects.createdAt))
            .limit(50),
          ctx.db
            .select({
              moduleId: organizationModules.moduleId,
              enabled: organizationModules.enabled,
            })
            .from(organizationModules)
            .where(eq(organizationModules.organizationId, input.id)),
          ctx.db
            .select({
              action: activityEvents.action,
              targetType: activityEvents.targetType,
              targetLabel: activityEvents.targetLabel,
              createdAt: activityEvents.createdAt,
            })
            .from(activityEvents)
            .where(eq(activityEvents.organizationId, input.id))
            .orderBy(desc(activityEvents.createdAt))
            .limit(25),
        ]);

      return {
        organization: {
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
        },
        people,
        pendingInvitations: openInvitations[0]?.value ?? 0,
        projects: projectRows,
        modules,
        recent,
      };
    }),

  setFlags: platformProcedure
    .input(
      idInput.extend({
        flags: z
          .record(flagName, z.boolean())
          .refine(
            (flags) => Object.keys(flags).length <= 50,
            "At most 50 flags.",
          ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const organization = await findOrganization(ctx.db, input.id);

      await ctx.db
        .update(organizations)
        .set({ featureFlags: input.flags })
        .where(eq(organizations.id, input.id));
      await recordPlatformAudit(ctx, {
        action: "tenant.flags_changed",
        organizationId: input.id,
        targetType: "organization",
        targetId: input.id,
        label: organization.name,
        detail: { before: organization.featureFlags, after: input.flags },
      });

      return { id: input.id };
    }),

  setLimits: platformProcedure
    .input(
      idInput.extend({
        members: z.number().int().min(1).max(1_000_000).nullable(),
        storageMb: z.number().int().min(1).max(100_000_000).nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const organization = await findOrganization(ctx.db, input.id);
      const limits = {
        ...(input.members === null ? {} : { members: input.members }),
        ...(input.storageMb === null ? {} : { storageMb: input.storageMb }),
      };

      await ctx.db
        .update(organizations)
        .set({ limits })
        .where(eq(organizations.id, input.id));
      await recordPlatformAudit(ctx, {
        action: "tenant.limits_changed",
        organizationId: input.id,
        targetType: "organization",
        targetId: input.id,
        label: organization.name,
        detail: { before: organization.limits, after: limits },
      });

      return { id: input.id };
    }),

  /** Everything the organization holds, as one JSON document, minus secrets. */
  export: platformProcedure
    .input(idInput.extend({ reason: reasonText }))
    .mutation(async ({ ctx, input }) => {
      const organization = await findOrganization(ctx.db, input.id);
      const tables = (await ctx.db.execute(
        sql`select table_name from information_schema.columns
            where table_schema = 'public' and column_name = 'organizationId'
            order by table_name`,
      )) as unknown as { rows: { table_name: string }[] };
      const data: Record<string, unknown> = {};

      for (const { table_name: table } of tables.rows) {
        if (exportSkips.test(table)) continue;

        const result = (await ctx.db.execute(
          sql`select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) as rows
              from ${sql.identifier(table)} t
              where t."organizationId" = ${input.id}`,
        )) as unknown as { rows: { rows: unknown }[] };

        data[table] = result.rows[0]?.rows ?? [];
      }

      const people = await ctx.db
        .select({ name: users.name, email: users.email, role: members.role })
        .from(members)
        .innerJoin(users, eq(users.id, members.userId))
        .where(eq(members.organizationId, input.id));

      await recordPlatformAudit(ctx, {
        action: "tenant.exported",
        organizationId: input.id,
        targetType: "organization",
        targetId: input.id,
        label: organization.name,
        detail: { reason: input.reason, tables: Object.keys(data).length },
      });

      return {
        exportedAt: new Date().toISOString(),
        organization: {
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          createdAt: organization.createdAt,
        },
        people,
        data,
      };
    }),

  /** Suspends the organization and schedules its data for deletion after a grace period. */
  requestDeletion: platformProcedure
    .input(idInput.extend({ confirmSlug: z.string().trim().min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const organization = await findOrganization(ctx.db, input.id);

      if (input.confirmSlug !== organization.slug) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Type the organization's slug to confirm.",
        });
      }

      const scheduledFor = new Date(
        Date.now() + DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000,
      );

      await ctx.db
        .update(organizations)
        .set({
          deletionScheduledFor: scheduledFor,
          suspendedAt: organization.suspendedAt ?? new Date(),
          suspendedReason: DELETION_REASON,
        })
        .where(eq(organizations.id, input.id));
      forgetOrganizationStatus(input.id);
      await recordPlatformAudit(ctx, {
        action: "tenant.deletion_requested",
        organizationId: input.id,
        targetType: "organization",
        targetId: input.id,
        label: organization.name,
        detail: { scheduledFor: scheduledFor.toISOString() },
      });

      return { id: input.id, scheduledFor };
    }),

  cancelDeletion: platformProcedure
    .input(idInput)
    .mutation(async ({ ctx, input }) => {
      const organization = await findOrganization(ctx.db, input.id);

      if (!organization.deletionScheduledFor) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No deletion is scheduled.",
        });
      }

      await ctx.db
        .update(organizations)
        .set({
          deletionScheduledFor: null,
          suspendedAt: null,
          suspendedReason: null,
        })
        .where(eq(organizations.id, input.id));
      forgetOrganizationStatus(input.id);
      await recordPlatformAudit(ctx, {
        action: "tenant.deletion_canceled",
        organizationId: input.id,
        targetType: "organization",
        targetId: input.id,
        label: organization.name,
      });

      return { id: input.id };
    }),
});
