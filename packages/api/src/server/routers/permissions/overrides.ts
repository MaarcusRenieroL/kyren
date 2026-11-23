import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "@zentro/db/drizzle";
import { permissionOverrides, users } from "@zentro/db/schema";
import { getPermission } from "@zentro/permissions";
import { z } from "zod";

import { assertHoldsAll } from "../../access";
import {
  assertAnyPermission,
  permissionProcedure,
  protectedProcedure,
  router,
} from "../../trpc";
import {
  assertMayModifyUser,
  loadMemberOfOrganization,
  resolveScope,
} from "./helpers";
import { notFound, scopeSchema, uuid } from "./types";

export const overridesRouter = router({
  list: permissionProcedure("roles.view")
    .input(z.object({ userId: uuid.optional() }).optional())
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(permissionOverrides.organizationId, ctx.activeOrganization.id),
      ];

      if (input?.userId) {
        conditions.push(eq(permissionOverrides.userId, input.userId));
      }

      const rows = await ctx.db
        .select()
        .from(permissionOverrides)
        .where(and(...conditions))
        .orderBy(desc(permissionOverrides.createdAt));
      const visibleProjects = new Set(
        await ctx.permissions.viewableProjectIds("projects.view"),
      );

      return rows.filter(
        (row) =>
          row.scopeType !== "project" || visibleProjects.has(row.scopeId),
      );
    }),

  set: protectedProcedure
    .meta({
      permissions: ["permissions.overrides.manage"],
      audit: ["override.set"],
    })
    .input(
      z.object({
        userId: uuid,
        permission: z.string().max(100),
        effect: z.enum(["allow", "deny"]),
        scopeType: scopeSchema,
        scopeId: uuid,
        reason: z.string().trim().max(300).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const resource = await resolveScope(ctx, input.scopeType, input.scopeId);

      await assertAnyPermission(
        ctx,
        ["permissions.overrides.manage"],
        resource,
      );
      await assertMayModifyUser(ctx, input.userId);

      const definition = getPermission(input.permission);

      if (!definition) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Unknown permission ${input.permission}.`,
        });
      }

      if (definition.ownerOnly) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Owner-only permissions cannot be overridden.",
        });
      }

      if (!definition.scopes.includes(input.scopeType)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `${definition.label} cannot be overridden at ${input.scopeType} level.`,
        });
      }

      if (input.effect === "allow") {
        await assertHoldsAll(ctx.permissions, [input.permission], resource);
      }

      const [existing] = await ctx.db
        .select()
        .from(permissionOverrides)
        .where(
          and(
            eq(permissionOverrides.userId, input.userId),
            eq(permissionOverrides.permission, input.permission),
            eq(permissionOverrides.scopeType, input.scopeType),
            eq(permissionOverrides.scopeId, input.scopeId),
          ),
        )
        .limit(1);

      const target = await loadMemberOfOrganization(ctx, input.userId);
      const [person] = await ctx.db
        .select({ name: users.name, email: users.email })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);
      const personName = person ? person.name || person.email : "someone";

      const override = await ctx.db.transaction(async (tx) => {
        const [row] = await tx
          .insert(permissionOverrides)
          .values({
            organizationId: ctx.activeOrganization.id,
            userId: input.userId,
            permission: input.permission,
            effect: input.effect,
            scopeType: input.scopeType,
            scopeId: input.scopeId,
            reason: input.reason ?? null,
            createdByUserId: ctx.user.id,
          })
          .onConflictDoUpdate({
            target: [
              permissionOverrides.userId,
              permissionOverrides.permission,
              permissionOverrides.scopeType,
              permissionOverrides.scopeId,
            ],
            set: { effect: input.effect, reason: input.reason ?? null },
          })
          .returning();

        await ctx.audit.record(tx, {
          action: "override.set",
          target: {
            id: row!.id,
            label: `${input.effect} ${input.permission} for ${personName}`,
          },
          projectId: input.scopeType === "project" ? input.scopeId : null,
          teamId: input.scopeType === "team" ? input.scopeId : null,
          metadata: {
            userId: input.userId,
            memberId: target?.id,
            personName,
            permission: input.permission,
            effect: input.effect,
            scopeType: input.scopeType,
            scopeId: input.scopeId,
            reason: input.reason ?? null,
            updated: Boolean(existing),
            before: existing ?? null,
            after: row,
          },
        });

        return row!;
      });

      return override;
    }),

  remove: protectedProcedure
    .meta({
      permissions: ["permissions.overrides.manage"],
      audit: ["override.removed"],
    })
    .input(z.object({ id: uuid }))
    .mutation(async ({ ctx, input }) => {
      const [override] = await ctx.db
        .select()
        .from(permissionOverrides)
        .where(
          and(
            eq(permissionOverrides.id, input.id),
            eq(permissionOverrides.organizationId, ctx.activeOrganization.id),
          ),
        )
        .limit(1);

      if (!override) {
        throw notFound("Override not found.");
      }

      const resource = await resolveScope(
        ctx,
        override.scopeType,
        override.scopeId,
      );

      await assertAnyPermission(
        ctx,
        ["permissions.overrides.manage"],
        resource,
      );
      await assertMayModifyUser(ctx, override.userId);

      if (override.effect === "deny") {
        await assertHoldsAll(ctx.permissions, [override.permission], resource);
      }

      const [person] = await ctx.db
        .select({ name: users.name, email: users.email })
        .from(users)
        .where(eq(users.id, override.userId))
        .limit(1);
      const personName = person ? person.name || person.email : "someone";

      await ctx.db.transaction(async (tx) => {
        await tx
          .delete(permissionOverrides)
          .where(eq(permissionOverrides.id, override.id));

        await ctx.audit.record(tx, {
          action: "override.removed",
          target: {
            id: override.id,
            label: `${override.effect} ${override.permission} for ${personName}`,
          },
          projectId: override.scopeType === "project" ? override.scopeId : null,
          teamId: override.scopeType === "team" ? override.scopeId : null,
          metadata: {
            userId: override.userId,
            personName,
            permission: override.permission,
            effect: override.effect,
            scopeType: override.scopeType,
            scopeId: override.scopeId,
            before: override,
          },
        });
      });

      return { id: override.id };
    }),
});
