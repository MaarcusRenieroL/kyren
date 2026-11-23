import { TRPCError } from "@trpc/server";
import { z } from "zod";

export const scopeSchema = z.enum(["organization", "team", "project"]);
export const uuid = z.string().uuid();

export function conflict(message: string) {
  return new TRPCError({ code: "CONFLICT", message });
}

export function notFound(message: string) {
  return new TRPCError({ code: "NOT_FOUND", message });
}

export function forbidden(message: string) {
  return new TRPCError({ code: "FORBIDDEN", message });
}

export const assignKeys: Record<z.infer<typeof scopeSchema>, string[]> = {
  organization: ["roles.assign"],
  team: ["roles.assign", "teams.members.manage"],
  project: ["roles.assign", "projects.members.manage"],
};

export const isOwnerRole = (role: string) =>
  role
    .split(",")
    .map((part) => part.trim())
    .includes("owner");

export const baseRank = { owner: 3, admin: 2, member: 1 } as const;

export function rankOf(role: string | null | undefined) {
  const parts = (role ?? "").split(",").map((part) => part.trim());

  if (parts.includes("owner")) return baseRank.owner;
  if (parts.includes("admin")) return baseRank.admin;
  if (parts.includes("member")) return baseRank.member;

  return 0;
}

export const roleInput = {
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(300).optional(),
};

export const permissionLogActions = [
  "role.%",
  "assignment.%",
  "override.%",
  "member.role_updated",
  "member.removed",
  "org.ownership_transferred",
  "org.updated",
  "invitation.%",
  "project.visibility_changed",
  "project.member_%",
];
