import type { PermissionScope } from "@zentro/modules";

export type BaseRole = "owner" | "admin" | "member";
export type ProjectVisibility = "organization" | "team" | "private";

export type SnapshotRole = {
  id: string;
  name: string;
  scope: PermissionScope;
  systemKey: string | null;
  permissions: string[];
};

export type SnapshotAssignment = {
  roleId: string;
  principalType: "user" | "team";
  principalId: string;
  scopeType: PermissionScope;
  scopeId: string;
};

export type SnapshotOverride = {
  permission: string;
  effect: "allow" | "deny";
  scopeType: PermissionScope;
  scopeId: string;
  reason?: string | null;
};

/** Everything the engine knows about one user in one organization. */
export type PermissionSnapshot = {
  organizationId: string;
  userId: string;
  /** Null when the user is not a member of the organization. */
  baseRole: BaseRole | null;
  /** Every role of the organization. */
  roles: SnapshotRole[];
  /** Assignments to the user and to teams the user belongs to. */
  assignments: SnapshotAssignment[];
  /** Teams the user belongs to. */
  teamIds: string[];
  overrides: SnapshotOverride[];
};

export type ProjectAccessInfo = {
  id: string;
  teamId: string | null;
  visibility: ProjectVisibility;
  /** "archived" makes the project read-only; the engine itself ignores it. */
  status?: string;
};

export type ResourceContext = {
  teamId?: string | null;
  projectId?: string | null;
  /** The user that owns the resource, for `_own` permissions. */
  ownerUserId?: string | null;
  /** Set for projects and for things inside a project. */
  project?: ProjectAccessInfo | null;
};

export type ReasonKind =
  | "owner"
  | "owner_only"
  | "role"
  | "assignment"
  | "override"
  | "visibility"
  | "own"
  | "unknown"
  | "none";

export type Reason = {
  kind: ReasonKind;
  message: string;
  roleName?: string;
};

export type Decision = {
  allowed: boolean;
  reasons: Reason[];
};

export type Scoped = { scopeType: PermissionScope; scopeId: string };

export type KeyState = {
  has: boolean;
  denied: boolean;
  reasons: Reason[];
};
