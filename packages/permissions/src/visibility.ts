import { evaluateKey } from "./evaluate";
import type {
  Decision,
  PermissionSnapshot,
  ProjectAccessInfo,
  Reason,
  ResourceContext,
} from "./types";

export function hasProjectAssignment(
  snapshot: PermissionSnapshot,
  projectId: string,
) {
  return snapshot.assignments.some(
    (assignment) =>
      assignment.scopeType === "project" && assignment.scopeId === projectId,
  );
}

/** Whether the user may see a project (and therefore what is inside it). */
export function checkProjectVisibility(
  snapshot: PermissionSnapshot,
  project: ProjectAccessInfo,
): Decision {
  if (snapshot.baseRole === "owner") {
    return {
      allowed: true,
      reasons: [{ kind: "owner", message: "Owners can see everything." }],
    };
  }

  if (!snapshot.baseRole && !hasProjectAssignment(snapshot, project.id)) {
    return {
      allowed: false,
      reasons: [
        { kind: "none", message: "Not a member of this organization." },
      ],
    };
  }

  const resource: ResourceContext = { project };
  const basic = evaluateKey(snapshot, "projects.view", resource);

  if (basic.denied) {
    return { allowed: false, reasons: basic.reasons };
  }

  const viewPrivate = evaluateKey(snapshot, "projects.view_private", resource);

  if (viewPrivate.denied) {
    // A deny on view_private only removes that extra access.
    viewPrivate.has = false;
  }

  const assigned = hasProjectAssignment(snapshot, project.id);
  const reasons: Reason[] = [];

  if (viewPrivate.has) {
    return {
      allowed: true,
      reasons: [
        {
          kind: "visibility",
          message: "Can view private and team projects.",
        },
        ...viewPrivate.reasons,
      ],
    };
  }

  if (assigned) {
    return {
      allowed: true,
      reasons: [{ kind: "visibility", message: "Has a role on this project." }],
    };
  }

  if (project.visibility === "organization") {
    if (basic.has) {
      return { allowed: true, reasons: basic.reasons };
    }

    reasons.push({ kind: "none", message: "Cannot view projects." });
  } else if (project.visibility === "team") {
    const inTeam =
      project.teamId !== null && snapshot.teamIds.includes(project.teamId);

    if (inTeam && basic.has) {
      return {
        allowed: true,
        reasons: [
          { kind: "visibility", message: "Member of the project's team." },
        ],
      };
    }

    reasons.push({
      kind: "visibility",
      message: "The project is visible to its team only.",
    });
  } else {
    reasons.push({
      kind: "visibility",
      message: "The project is private.",
    });
  }

  return { allowed: false, reasons };
}
