import { TRPCError } from "@trpc/server";
import {
  getCatalog,
  getPermission,
  check as engineCheck,
} from "@kyren/permissions";
import { z } from "zod";

import { loadEnabledModules } from "../../modules";
import { loadPermissionSnapshot } from "../../permissions";
import { loadProjectById } from "../../resources";
import { permissionProcedure, protectedProcedure } from "../../trpc";
import { loadMemberOfOrganization, permissionMap } from "./helpers";
import { notFound, uuid } from "./types";

export const permissionEvaluationProcedures = {
  // Describes what exists; shown to people who may see roles.
  catalog: permissionProcedure("roles.view").query(async ({ ctx }) => {
    const enabled = await loadEnabledModules(ctx.db, ctx.activeOrganization.id);

    return {
      permissions: getCatalog().map((entry) => ({
        key: entry.key,
        label: entry.label,
        description: entry.description,
        module: entry.module,
        group: entry.group,
        scopes: entry.scopes,
        ownerOnly: Boolean(entry.ownerOnly),
        uiOnly: entry.uiOnly ?? null,
        // Permissions of a turned-off module are hidden and inert.
        enabled:
          entry.module === "platform" || enabled.has(entry.module as never),
      })),
    };
  }),

  // The caller's own permissions; always available to a signed-in member.
  me: protectedProcedure.query(async ({ ctx }) => {
    const snapshot = await ctx.permissions.snapshot();

    return {
      baseRole: snapshot.baseRole,
      userId: snapshot.userId,
      permissions: permissionMap(snapshot, {}),
      // Held organization-wide or in at least one project or team; decides
      // which modules and routes the caller sees.
      reachable: await ctx.permissions.reachable(
        getCatalog().map((entry) => entry.key),
      ),
    };
  }),

  // The caller's permissions for one project or team. `ownerUserId` is the
  // creator of the item on screen, so `_own` permissions resolve for it.
  check: protectedProcedure
    .input(
      z.object({
        projectId: uuid.optional(),
        teamId: uuid.optional(),
        ownerUserId: uuid.optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const snapshot = await ctx.permissions.snapshot();
      const project = input.projectId
        ? ((await loadProjectById(ctx, input.projectId)) ?? null)
        : null;

      return {
        permissions: permissionMap(snapshot, {
          project,
          teamId: input.teamId ?? null,
          ownerUserId: input.ownerUserId ?? null,
        }),
      };
    }),

  explain: permissionProcedure("permissions.explain")
    .input(
      z.object({
        userId: uuid,
        permission: z.string().max(100),
        projectId: uuid.optional(),
        teamId: uuid.optional(),
        ownerUserId: uuid.optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const target = await loadMemberOfOrganization(ctx, input.userId);

      if (!target) {
        throw notFound("That person is not a member of this organization.");
      }

      if (!getPermission(input.permission)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Unknown permission ${input.permission}.`,
        });
      }

      const snapshot = await loadPermissionSnapshot(
        ctx.db,
        ctx.activeOrganization.id,
        input.userId,
      );
      const project = input.projectId
        ? ((await loadProjectById(ctx, input.projectId)) ?? null)
        : null;
      const decision = engineCheck(snapshot, input.permission, {
        project,
        teamId: input.teamId ?? null,
        ownerUserId: input.ownerUserId ?? null,
      });

      return {
        allowed: decision.allowed,
        reasons: decision.reasons,
        baseRole: snapshot.baseRole,
      };
    }),
};
