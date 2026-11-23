import { and, asc, desc, eq, inArray, or } from "@zentro/db/drizzle";
import {
  projects,
  roleAssignments,
  roles,
  teams,
  users,
} from "@zentro/db/schema";
import { z } from "zod";

import {
  assertAnyPermission,
  permissionProcedure,
  protectedProcedure,
} from "../../trpc";
import { resolveScope } from "./helpers";
import { scopeSchema, uuid } from "./types";

export const assignmentQueryProcedures = {
  list: permissionProcedure("roles.view")
    .input(
      z
        .object({
          userId: uuid.optional(),
          roleId: uuid.optional(),
          scopeType: scopeSchema.optional(),
          scopeId: uuid.optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.activeOrganization.id;
      const conditions = [eq(roleAssignments.organizationId, organizationId)];

      if (input?.userId) {
        conditions.push(
          eq(roleAssignments.principalType, "user"),
          eq(roleAssignments.principalId, input.userId),
        );
      }

      if (input?.roleId)
        conditions.push(eq(roleAssignments.roleId, input.roleId));
      if (input?.scopeType)
        conditions.push(eq(roleAssignments.scopeType, input.scopeType));
      if (input?.scopeId)
        conditions.push(eq(roleAssignments.scopeId, input.scopeId));

      const allRows = await ctx.db
        .select({
          id: roleAssignments.id,
          roleId: roleAssignments.roleId,
          roleName: roles.name,
          principalType: roleAssignments.principalType,
          principalId: roleAssignments.principalId,
          scopeType: roleAssignments.scopeType,
          scopeId: roleAssignments.scopeId,
          createdAt: roleAssignments.createdAt,
        })
        .from(roleAssignments)
        .innerJoin(roles, eq(roles.id, roleAssignments.roleId))
        .where(and(...conditions))
        .orderBy(desc(roleAssignments.createdAt));

      const visibleProjects = new Set(
        await ctx.permissions.viewableProjectIds("projects.view"),
      );
      const rows = allRows.filter(
        (row) =>
          row.scopeType !== "project" || visibleProjects.has(row.scopeId),
      );

      const userIds = rows
        .filter((row) => row.principalType === "user")
        .map((row) => row.principalId);
      const teamIds = [
        ...rows
          .filter((row) => row.principalType === "team")
          .map((row) => row.principalId),
        ...rows
          .filter((row) => row.scopeType === "team")
          .map((row) => row.scopeId),
      ];
      const projectIds = rows
        .filter((row) => row.scopeType === "project")
        .map((row) => row.scopeId);

      const [userRows, teamRows, projectRows] = await Promise.all([
        userIds.length
          ? ctx.db
              .select({ id: users.id, name: users.name, email: users.email })
              .from(users)
              .where(inArray(users.id, userIds))
          : [],
        teamIds.length
          ? ctx.db
              .select({ id: teams.id, name: teams.name })
              .from(teams)
              .where(inArray(teams.id, teamIds))
          : [],
        projectIds.length
          ? ctx.db
              .select({ id: projects.id, name: projects.name })
              .from(projects)
              .where(inArray(projects.id, projectIds))
          : [],
      ]);

      return rows.map((row) => ({
        ...row,
        principalName:
          row.principalType === "user"
            ? (userRows.find((user) => user.id === row.principalId)?.name ??
              userRows.find((user) => user.id === row.principalId)?.email ??
              "Unknown user")
            : (teamRows.find((team) => team.id === row.principalId)?.name ??
              "Unknown team"),
        scopeName:
          row.scopeType === "organization"
            ? ctx.activeOrganization.name
            : row.scopeType === "team"
              ? (teamRows.find((team) => team.id === row.scopeId)?.name ??
                "Unknown team")
              : (projectRows.find((project) => project.id === row.scopeId)
                  ?.name ?? "Unknown project"),
      }));
    }),

  listForTeam: protectedProcedure
    .meta({ permissions: ["roles.view", "teams.members.manage"] })
    .input(z.object({ teamId: uuid }))
    .query(async ({ ctx, input }) => {
      const resource = await resolveScope(ctx, "team", input.teamId);

      await assertAnyPermission(
        ctx,
        ["roles.view", "teams.members.manage"],
        resource,
      );

      const rows = await ctx.db
        .select({
          id: roleAssignments.id,
          roleId: roleAssignments.roleId,
          roleName: roles.name,
          principalType: roleAssignments.principalType,
          principalId: roleAssignments.principalId,
          scopeType: roleAssignments.scopeType,
          scopeId: roleAssignments.scopeId,
        })
        .from(roleAssignments)
        .innerJoin(roles, eq(roles.id, roleAssignments.roleId))
        .where(
          and(
            eq(roleAssignments.organizationId, ctx.activeOrganization.id),
            or(
              and(
                eq(roleAssignments.scopeType, "team"),
                eq(roleAssignments.scopeId, input.teamId),
              ),
              and(
                eq(roleAssignments.principalType, "team"),
                eq(roleAssignments.principalId, input.teamId),
              ),
            ),
          ),
        )
        .orderBy(desc(roleAssignments.createdAt));

      const userIds = rows
        .filter((row) => row.principalType === "user")
        .map((row) => row.principalId);
      const [userRows, teamRoles] = await Promise.all([
        userIds.length
          ? ctx.db
              .select({ id: users.id, name: users.name, email: users.email })
              .from(users)
              .where(inArray(users.id, userIds))
          : [],
        ctx.db
          .select({ id: roles.id, name: roles.name })
          .from(roles)
          .where(
            and(
              eq(roles.organizationId, ctx.activeOrganization.id),
              eq(roles.scope, "team"),
            ),
          )
          .orderBy(asc(roles.name)),
      ]);

      return {
        teamRoles,
        assignments: rows.map((row) => {
          const user = userRows.find((item) => item.id === row.principalId);

          return {
            ...row,
            principalName:
              row.principalType === "user"
                ? (user?.name ?? user?.email ?? "Unknown user")
                : "Whole team",
            scopeName:
              row.scopeType === "organization"
                ? ctx.activeOrganization.name
                : "This team",
          };
        }),
      };
    }),
};
