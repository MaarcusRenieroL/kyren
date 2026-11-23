import { TRPCError } from "@trpc/server";
import { and, eq } from "@kyren/db/drizzle";
import { roles } from "@kyren/db/schema";
import { getPermission, getSystemRoleDefinition } from "@kyren/permissions";
import { z } from "zod";

import { buildChanges } from "@kyren/audit";

import { assertHoldsAll } from "../../access";
import { permissionProcedure } from "../../trpc";
import {
  assertOwnerForAdminRole,
  assignmentCount,
  loadRole,
  summarizeRole,
  validatePermissionKeys,
} from "./helpers";
import {
  conflict,
  forbidden,
  notFound,
  roleInput,
  scopeSchema,
  uuid,
} from "./types";

export const roleMutationProcedures = {
  create: permissionProcedure("roles.create", undefined, {
    audit: ["role.created"],
  })
    .input(
      z.object({
        ...roleInput,
        scope: scopeSchema,
        permissions: z.array(z.string().max(100)).max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const keys = validatePermissionKeys(input.scope, input.permissions);

      await assertHoldsAll(ctx.permissions, keys);

      const role = await ctx.db.transaction(async (tx) => {
        const [created] = await tx
          .insert(roles)
          .values({
            organizationId: ctx.activeOrganization.id,
            name: input.name,
            description: input.description ?? null,
            scope: input.scope,
            kind: "custom",
            permissions: keys,
            createdByUserId: ctx.user.id,
          })
          .onConflictDoNothing()
          .returning();

        if (!created) {
          throw conflict("A role with this name already exists.");
        }

        await ctx.audit.record(tx, {
          action: "role.created",
          target: { id: created.id, label: created.name },
          metadata: { after: summarizeRole(created) },
        });

        return created;
      });

      return role;
    }),

  update: permissionProcedure("roles.update", undefined, {
    audit: ["role.updated"],
  })
    .input(
      z.object({
        id: uuid,
        name: roleInput.name.optional(),
        description: roleInput.description,
        permissions: z.array(z.string().max(100)).max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const role = await loadRole(ctx, input.id);
      const isBaseSystemRole =
        role.systemKey === "admin" || role.systemKey === "member";

      if (role.systemKey === "owner") {
        throw forbidden("The Owner role cannot be changed.");
      }

      if (role.kind === "system" && !isBaseSystemRole) {
        throw forbidden("This system role cannot be changed.");
      }

      await assertOwnerForAdminRole(ctx, role.systemKey);

      if (isBaseSystemRole && input.name && input.name !== role.name) {
        throw forbidden("System roles cannot be renamed.");
      }

      const nextPermissions = input.permissions
        ? validatePermissionKeys(role.scope, input.permissions)
        : role.permissions;

      await assertHoldsAll(
        ctx.permissions,
        [...role.permissions, ...nextPermissions],
        {},
        "You cannot edit a role that grants permissions you do not hold.",
      );

      const updated = await ctx.db.transaction(async (tx) => {
        const [row] = await tx
          .update(roles)
          .set({
            ...(input.name ? { name: input.name } : {}),
            ...(input.description !== undefined
              ? { description: input.description }
              : {}),
            permissions: nextPermissions,
            updatedAt: new Date(),
          })
          .where(eq(roles.id, role.id))
          .returning()
          .catch(() => {
            throw conflict("A role with this name already exists.");
          });

        await ctx.audit.record(tx, {
          action: "role.updated",
          target: { id: role.id, label: row!.name },
          changes: buildChanges(
            { name: role.name, description: role.description },
            { name: row!.name, description: row!.description },
          ),
          metadata: {
            before: summarizeRole(role),
            after: summarizeRole(row!),
            addedPermissions: nextPermissions.filter(
              (key) => !role.permissions.includes(key),
            ),
            removedPermissions: role.permissions.filter(
              (key) => !nextPermissions.includes(key),
            ),
          },
        });

        return row!;
      });

      return updated;
    }),

  delete: permissionProcedure("roles.delete", undefined, {
    audit: ["role.deleted"],
  })
    .input(z.object({ id: uuid }))
    .mutation(async ({ ctx, input }) => {
      const role = await loadRole(ctx, input.id);

      if (role.kind === "system") {
        throw forbidden("System roles cannot be deleted.");
      }

      const assigned = await assignmentCount(ctx, role.id);

      if (assigned > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `This role is assigned ${assigned} time${assigned === 1 ? "" : "s"}. Reassign or remove those assignments first.`,
        });
      }

      await ctx.db.transaction(async (tx) => {
        await tx.delete(roles).where(eq(roles.id, role.id));
        await ctx.audit.record(tx, {
          action: "role.deleted",
          target: { id: role.id, label: role.name },
          metadata: { before: summarizeRole(role) },
        });
      });

      return { id: role.id };
    }),

  clone: permissionProcedure("roles.create", undefined, {
    audit: ["role.cloned"],
  })
    .input(z.object({ id: uuid, name: roleInput.name }))
    .mutation(async ({ ctx, input }) => {
      const source = await loadRole(ctx, input.id);
      const keys = source.permissions.filter(
        (key) => !getPermission(key)?.ownerOnly,
      );

      await assertHoldsAll(ctx.permissions, keys);

      const role = await ctx.db.transaction(async (tx) => {
        const [created] = await tx
          .insert(roles)
          .values({
            organizationId: ctx.activeOrganization.id,
            name: input.name,
            description: source.description,
            scope: source.scope,
            kind: "custom",
            permissions: keys,
            createdByUserId: ctx.user.id,
          })
          .onConflictDoNothing()
          .returning();

        if (!created) {
          throw conflict("A role with this name already exists.");
        }

        await ctx.audit.record(tx, {
          action: "role.cloned",
          target: { id: created.id, label: created.name },
          metadata: {
            clonedFrom: source.id,
            clonedFromName: source.name,
            after: summarizeRole(created),
          },
        });

        return created;
      });

      return role;
    }),

  resetSystem: permissionProcedure("roles.update", undefined, {
    audit: ["role.reset"],
  })
    .input(z.object({ systemKey: z.enum(["admin", "member"]) }))
    .mutation(async ({ ctx, input }) => {
      await assertOwnerForAdminRole(ctx, input.systemKey);

      const definition = getSystemRoleDefinition(input.systemKey)!;
      const [role] = await ctx.db
        .select()
        .from(roles)
        .where(
          and(
            eq(roles.organizationId, ctx.activeOrganization.id),
            eq(roles.systemKey, input.systemKey),
          ),
        )
        .limit(1);

      if (!role) {
        throw notFound("Role not found.");
      }

      await assertHoldsAll(
        ctx.permissions,
        [...role.permissions, ...definition.permissions],
        {},
        "You cannot reset a role that grants permissions you do not hold.",
      );

      const updated = await ctx.db.transaction(async (tx) => {
        const [row] = await tx
          .update(roles)
          .set({
            permissions: definition.permissions,
            appliedDefaults: definition.permissions,
            updatedAt: new Date(),
          })
          .where(eq(roles.id, role.id))
          .returning();

        await ctx.audit.record(tx, {
          action: "role.reset",
          target: { id: role.id, label: role.name },
          metadata: {
            before: summarizeRole(role),
            after: summarizeRole(row!),
          },
        });

        return row!;
      });

      return updated;
    }),
};
