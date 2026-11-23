import { db } from "@zentro/db";
import { eq } from "@zentro/db/drizzle";
import { permissionOverrides, roleAssignments, roles } from "@zentro/db/schema";
import { ensureSystemRoles } from "@zentro/auth";
import type { TestOrg, TestUser } from "./world-types";

export async function getSystemRoleId(org: TestOrg, systemKey: string) {
  await ensureSystemRoles(db, org.id);

  const [role] = await db
    .select({ id: roles.id })
    .from(roles)
    .where(eq(roles.organizationId, org.id));
  const all = await db
    .select()
    .from(roles)
    .where(eq(roles.organizationId, org.id));

  return (all.find((item) => item.systemKey === systemKey) ?? role)!.id;
}

export async function createCustomRole(
  org: TestOrg,
  values: {
    name: string;
    scope?: "organization" | "team" | "project";
    permissions: string[];
  },
) {
  const [role] = await db
    .insert(roles)
    .values({
      organizationId: org.id,
      name: values.name,
      scope: values.scope ?? "organization",
      kind: "custom",
      permissions: values.permissions,
    })
    .returning();

  return role!;
}

export async function createRoleAssignment(
  org: TestOrg,
  roleId: string,
  principal: { type: "user" | "team"; id: string },
  scope: { type: "organization" | "team" | "project"; id: string },
) {
  const [assignment] = await db
    .insert(roleAssignments)
    .values({
      organizationId: org.id,
      roleId,
      principalType: principal.type,
      principalId: principal.id,
      scopeType: scope.type,
      scopeId: scope.id,
    })
    .returning();

  return assignment!;
}

export async function createPermissionOverride(
  org: TestOrg,
  user: TestUser,
  permission: string,
  effect: "allow" | "deny",
  scope: { type: "organization" | "team" | "project"; id: string } = {
    type: "organization",
    id: org.id,
  },
) {
  await db.insert(permissionOverrides).values({
    organizationId: org.id,
    userId: user.id,
    permission,
    effect,
    scopeType: scope.type,
    scopeId: scope.id,
  });
}
