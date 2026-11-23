import { getPermission } from "./catalog";
import type {
  KeyState,
  PermissionSnapshot,
  Reason,
  ResourceContext,
  Scoped,
} from "./types";

export function resolveContext(resource: ResourceContext) {
  return {
    teamId: resource.teamId ?? resource.project?.teamId ?? null,
    projectId: resource.projectId ?? resource.project?.id ?? null,
  };
}

export function appliesTo(
  snapshot: PermissionSnapshot,
  scoped: Scoped,
  resource: ResourceContext,
) {
  const { teamId, projectId } = resolveContext(resource);

  if (scoped.scopeType === "organization") {
    return scoped.scopeId === snapshot.organizationId;
  }

  if (scoped.scopeType === "team") {
    return teamId !== null && scoped.scopeId === teamId;
  }

  return projectId !== null && scoped.scopeId === projectId;
}

export function evaluateKey(
  snapshot: PermissionSnapshot,
  key: string,
  resource: ResourceContext,
): KeyState {
  const reasons: Reason[] = [];
  const definition = getPermission(key);

  const denies = snapshot.overrides.filter(
    (override) =>
      override.permission === key &&
      override.effect === "deny" &&
      appliesTo(snapshot, override, resource),
  );

  if (denies.length) {
    return {
      has: false,
      denied: true,
      reasons: denies.map((override) => ({
        kind: "override",
        message: `Denied by an override${override.reason ? `: ${override.reason}` : ""}.`,
      })),
    };
  }

  let has = false;

  // The system role for the base organization role.
  if (snapshot.baseRole && snapshot.baseRole !== "owner") {
    const base = snapshot.roles.find(
      (role) => role.systemKey === snapshot.baseRole,
    );

    if (base?.permissions.includes(key)) {
      has = true;
      reasons.push({
        kind: "role",
        message: `Granted by the ${base.name} role.`,
        roleName: base.name,
      });
    }
  }

  // Roles assigned at the organization, to the resource's team or project.
  for (const assignment of snapshot.assignments) {
    if (!appliesTo(snapshot, assignment, resource)) {
      continue;
    }

    if (definition && !definition.scopes.includes(assignment.scopeType)) {
      continue;
    }

    const role = snapshot.roles.find((item) => item.id === assignment.roleId);

    if (role?.permissions.includes(key)) {
      has = true;
      reasons.push({
        kind: "assignment",
        message: `Granted by the ${role.name} role assigned at ${assignment.scopeType} level.`,
        roleName: role.name,
      });
    }
  }

  const allows = snapshot.overrides.filter(
    (override) =>
      override.permission === key &&
      override.effect === "allow" &&
      appliesTo(snapshot, override, resource),
  );

  for (const override of allows) {
    has = true;
    reasons.push({
      kind: "override",
      message: `Allowed by an override${override.reason ? `: ${override.reason}` : ""}.`,
    });
  }

  return { has, denied: false, reasons };
}
