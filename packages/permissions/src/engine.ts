import { getAnyKey, getPermission } from "./catalog";
import { evaluateKey } from "./evaluate";
import type {
  Decision,
  PermissionSnapshot,
  ProjectAccessInfo,
  ResourceContext,
} from "./types";
import { checkProjectVisibility } from "./visibility";

export * from "./types";
export { checkProjectVisibility } from "./visibility";

/** Checks one permission, with ownership and project visibility applied. */
export function check(
  snapshot: PermissionSnapshot,
  key: string,
  resource: ResourceContext = {},
): Decision {
  const definition = getPermission(key);

  if (!definition) {
    return {
      allowed: false,
      reasons: [{ kind: "unknown", message: `Unknown permission ${key}.` }],
    };
  }

  if (snapshot.baseRole === "owner") {
    return {
      allowed: true,
      reasons: [{ kind: "owner", message: "Owners can do everything." }],
    };
  }

  if (definition.ownerOnly) {
    return {
      allowed: false,
      reasons: [
        {
          kind: "owner_only",
          message: "Only the organization owner can do this.",
        },
      ],
    };
  }

  if (!snapshot.baseRole && !snapshot.assignments.length) {
    return {
      allowed: false,
      reasons: [
        { kind: "none", message: "Not a member of this organization." },
      ],
    };
  }

  // Everything inside a project needs access to the project first.
  if (resource.project) {
    const visibility = checkProjectVisibility(snapshot, resource.project);

    if (!visibility.allowed) {
      return visibility;
    }

    if (key === "projects.view") {
      return visibility;
    }
  }

  const anyKey = getAnyKey(key);

  if (anyKey) {
    const own = evaluateKey(snapshot, key, resource);
    const any = evaluateKey(snapshot, anyKey, resource);

    if (own.denied || any.denied) {
      return { allowed: false, reasons: [...own.reasons, ...any.reasons] };
    }

    if (any.has) {
      return { allowed: true, reasons: any.reasons };
    }

    if (own.has) {
      if (resource.ownerUserId && resource.ownerUserId === snapshot.userId) {
        return {
          allowed: true,
          reasons: [
            { kind: "own", message: "The user owns this item." },
            ...own.reasons,
          ],
        };
      }

      return {
        allowed: false,
        reasons: [
          {
            kind: "own",
            message: "Only allowed on items the user owns.",
          },
        ],
      };
    }

    return {
      allowed: false,
      reasons: [{ kind: "none", message: `No role grants ${key}.` }],
    };
  }

  const state = evaluateKey(snapshot, key, resource);

  if (state.has) {
    return { allowed: true, reasons: state.reasons };
  }

  return {
    allowed: false,
    reasons: state.denied
      ? state.reasons
      : [{ kind: "none", message: `No role grants ${key}.` }],
  };
}

export function can(
  snapshot: PermissionSnapshot,
  key: string,
  resource: ResourceContext = {},
) {
  return check(snapshot, key, resource).allowed;
}

/** True when the user holds every key at the given scope. */
export function holdsAll(
  snapshot: PermissionSnapshot,
  keys: readonly string[],
  resource: ResourceContext = {},
) {
  return keys.every((key) => can(snapshot, key, resource));
}

/** Organization-level decision for each key, for gating the UI. */
export function effectivePermissions(
  snapshot: PermissionSnapshot,
  keys: readonly string[],
  resource: ResourceContext = {},
) {
  return Object.fromEntries(
    keys.map((key) => [key, can(snapshot, key, resource)]),
  );
}

/**
 * Whether each key is reachable somewhere: granted organization-wide, or in at
 * least one project or team the user can work in. Decides which modules and
 * routes a person sees; the server still decides every request.
 */
export function reachablePermissions(
  snapshot: PermissionSnapshot,
  projectList: readonly ProjectAccessInfo[],
  keys: readonly string[],
) {
  const teamIds = Array.from(
    new Set(
      snapshot.assignments
        .filter((assignment) => assignment.scopeType === "team")
        .map((assignment) => assignment.scopeId),
    ),
  );

  return Object.fromEntries(
    keys.map((key) => [
      key,
      can(snapshot, key) ||
        projectList.some((project) => can(snapshot, key, { project })) ||
        teamIds.some((teamId) => can(snapshot, key, { teamId })),
    ]),
  ) as Record<string, boolean>;
}

/** Keys the engine itself applies inside every project-scoped check. */
export const engineEnforcedKeys = ["projects.view_private"] as const;
