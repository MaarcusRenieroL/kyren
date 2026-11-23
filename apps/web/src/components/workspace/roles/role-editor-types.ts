import { listModules } from "@kyren/modules";

export type Role = {
  id: string;
  name: string;
  description: string | null;
  scope: "organization" | "team" | "project";
  kind: "system" | "custom";
  systemKey: string | null;
  permissions: string[];
};

export const moduleNames: Record<string, string> = {
  platform: "Platform",
  ...Object.fromEntries(
    listModules().map((module) => [module.id, module.name]),
  ),
};
