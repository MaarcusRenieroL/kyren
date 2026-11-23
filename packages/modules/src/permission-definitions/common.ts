import type { PermissionDefinition, PermissionScope } from "../types";

export const org: PermissionScope[] = ["organization"];
export const orgTeam: PermissionScope[] = ["organization", "team"];
export const all: PermissionScope[] = ["organization", "team", "project"];

export type Options = { ownerOnly?: boolean; uiOnly?: string };

export function definePermission(
  key: string,
  label: string,
  description: string,
  group: string,
  scopes: PermissionScope[],
  options: Options = {},
): PermissionDefinition {
  return { key, label, description, group, scopes, ...options };
}
