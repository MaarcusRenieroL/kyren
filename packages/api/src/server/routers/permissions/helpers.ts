import { TRPCError } from "@trpc/server";
import { and, count, eq } from "@zentro/db/drizzle";
import {
  members,
  projects,
  roleAssignments,
  roles,
  teams,
  users,
} from "@zentro/db/schema";
import {
  getCatalog,
  getPermission,
  check as engineCheck,
  type PermissionSnapshot,
  type ResourceContext,
} from "@zentro/permissions";
import { z } from "zod";

import { loadProjectById } from "../../resources";
import { type OrganizationContext } from "../../trpc";
import { notFound, scopeSchema } from "./types";

export {
  assertMayModifyUser,
  assertOwnerForAdminRole,
  assertTeamLeadBounds,
} from "./guards";

/** Rejects unknown keys, owner-only keys and keys the scope cannot hold. */
export function validatePermissionKeys(
  scope: z.infer<typeof scopeSchema>,
  keys: readonly string[],
) {
  for (const key of keys) {
    const definition = getPermission(key);

    if (!definition) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Unknown permission ${key}.`,
      });
    }

    if (definition.ownerOnly) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `${definition.label} is reserved for the owner and cannot be granted.`,
      });
    }

    if (!definition.scopes.includes(scope)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `${definition.label} cannot be granted at ${scope} level.`,
      });
    }
  }

  return Array.from(new Set(keys));
}

export async function loadRole(ctx: OrganizationContext, id: string) {
  const [role] = await ctx.db
    .select()
    .from(roles)
    .where(
      and(
        eq(roles.id, id),
        eq(roles.organizationId, ctx.activeOrganization.id),
      ),
    )
    .limit(1);

  if (!role) {
    throw notFound("Role not found.");
  }

  return role;
}

export async function assignmentCount(ctx: OrganizationContext, roleId: string) {
  const [row] = await ctx.db
    .select({ count: count() })
    .from(roleAssignments)
    .where(eq(roleAssignments.roleId, roleId));

  return row?.count ?? 0;
}

/** The resource a scope refers to, checked to belong to the organization. */
export async function resolveScope(
  ctx: OrganizationContext,
  scopeType: z.infer<typeof scopeSchema>,
  scopeId: string,
): Promise<ResourceContext> {
  const organizationId = ctx.activeOrganization.id;

  if (scopeType === "organization") {
    if (scopeId !== organizationId) {
      throw notFound("Scope not found.");
    }

    return {};
  }

  if (scopeType === "team") {
    const [team] = await ctx.db
      .select({ id: teams.id })
      .from(teams)
      .where(
        and(eq(teams.id, scopeId), eq(teams.organizationId, organizationId)),
      )
      .limit(1);

    if (!team) {
      throw notFound("Team not found.");
    }

    return { teamId: team.id };
  }

  const project = await loadProjectById(ctx, scopeId);

  if (!project) {
    throw notFound("Project not found.");
  }

  return { project };
}

/** Names for an assignment's scope and principal, kept with the event. */
export async function describeAssignment(
  ctx: OrganizationContext,
  assignment: {
    scopeType: z.infer<typeof scopeSchema>;
    scopeId: string;
    principalType: "user" | "team";
    principalId: string;
  },
) {
  let scopeName = ctx.activeOrganization.name;

  if (assignment.scopeType === "team") {
    const [row] = await ctx.db
      .select({ name: teams.name })
      .from(teams)
      .where(eq(teams.id, assignment.scopeId))
      .limit(1);

    scopeName = row?.name ?? "a team";
  } else if (assignment.scopeType === "project") {
    const [row] = await ctx.db
      .select({ name: projects.name })
      .from(projects)
      .where(eq(projects.id, assignment.scopeId))
      .limit(1);

    scopeName = row?.name ?? "a project";
  }

  let principalName: string | null = null;

  if (assignment.principalType === "user") {
    const [row] = await ctx.db
      .select({ name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, assignment.principalId))
      .limit(1);

    principalName = row ? row.name || row.email : null;
  } else {
    const [row] = await ctx.db
      .select({ name: teams.name })
      .from(teams)
      .where(eq(teams.id, assignment.principalId))
      .limit(1);

    principalName = row?.name ?? null;
  }

  return { scopeName, principalName };
}

export async function loadMemberOfOrganization(
  ctx: OrganizationContext,
  userId: string,
) {
  const [member] = await ctx.db
    .select({ id: members.id, userId: members.userId, role: members.role })
    .from(members)
    .where(
      and(
        eq(members.userId, userId),
        eq(members.organizationId, ctx.activeOrganization.id),
      ),
    )
    .limit(1);

  return member;
}

export function summarizeRole(role: typeof roles.$inferSelect) {
  return {
    id: role.id,
    name: role.name,
    scope: role.scope,
    kind: role.kind,
    systemKey: role.systemKey,
    permissions: role.permissions,
  };
}

export function permissionMap(
  snapshot: PermissionSnapshot,
  resource: ResourceContext,
) {
  return Object.fromEntries(
    getCatalog().map((entry) => [
      entry.key,
      engineCheck(snapshot, entry.key, resource).allowed,
    ]),
  );
}
