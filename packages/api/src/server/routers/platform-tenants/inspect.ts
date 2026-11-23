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



export const platformTenantsInspectProcedures = {
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

};
