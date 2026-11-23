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
} from "@kyren/db/drizzle";
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
} from "@kyren/db/schema";
import type { db as Database } from "@kyren/db";
import { z } from "zod";

import { recordPlatformAudit } from "../../platform-audit";
import { forgetOrganizationStatus } from "../../platform-policy";
import { platformProcedure, router } from "../../trpc";

/** How long a deleted organization can still be brought back. */
export const DELETION_GRACE_DAYS = 14;
export const DELETION_REASON = "Scheduled for deletion";

const idInput = z.object({ id: z.string().uuid() });
const reasonText = z.string().trim().min(3).max(300);
const flagName = z.string().regex(/^[a-z][a-z0-9_.-]{0,39}$/);

// Tables that hold secrets stay out of an export.
const exportSkips =
  /api_?key|webhook|secret|token|session|account|verification/i;

// So do secret columns in ordinary tables: the links behind an inbox, an
// intake form or a customer portal work for whoever holds them.
const secretColumn = /token|secret|password|hash/i;

function withoutSecrets(rows: unknown) {
  return Array.isArray(rows)
    ? rows.map((row) =>
        Object.fromEntries(
          Object.entries(row as Record<string, unknown>).filter(
            ([column]) => !secretColumn.test(column),
          ),
        ),
      )
    : [];
}

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



export const platformTenantsDirectoryProcedures = {
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

};
