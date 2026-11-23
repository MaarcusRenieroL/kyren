import { auditCatalog } from "@kyren/audit";
import type { sentenceFor } from "../activity-feed";

export type Row = Parameters<typeof sentenceFor>[0] & {
  targetId: string;
  projectId: string | null;
  auditOnly: boolean;
  ip: string | null;
  userAgent: string | null;
  requestId: string | null;
};

export const allValue = "__all__";
export const prefixes = Array.from(
  new Set(auditCatalog.map((entry) => `${entry.key.split(".")[0]}.`)),
);

export const moduleNames: Record<string, string> = {
  task: "Tasks",
  project: "Projects",
  doc: "Docs",
  role: "Roles",
  org: "Org",
  member: "Members",
  invitation: "Members",
  team: "Teams",
  auth: "Auth",
  audit: "Audit",
  module: "Modules",
};

export function moduleOf(action: string) {
  const prefix = action.split(".")[0] ?? "";

  return (
    moduleNames[prefix] ?? prefix.charAt(0).toUpperCase() + prefix.slice(1)
  );
}

export function clock(date: Date) {
  return new Date(date).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function dayHeading(date: Date) {
  const day = new Date(date);
  const now = new Date();
  const diff = Math.round(
    (new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() -
      new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime()) /
      86_400_000,
  );
  const label = day
    .toLocaleDateString("en-US", { month: "short", day: "numeric" })
    .toUpperCase();

  return diff === 0
    ? `TODAY · ${label}`
    : diff === 1
      ? `YESTERDAY · ${label}`
      : label;
}

export const chip =
  "h-8 shrink-0 gap-1.5 rounded-xl border-hairline bg-transparent px-2.5 text-[13px] shadow-none data-[size=default]:h-8";
