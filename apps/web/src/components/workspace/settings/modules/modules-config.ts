import type { TileTint } from "@zentro/ui/components/tile";

export const tints: Record<string, string> = {
  dashboard: "bg-tint-tasks",
  settings: "bg-tint-audit",
  projects: "bg-tint-projects",
  tasks: "bg-tint-tasks",
  docs: "bg-tint-docs",
  tickets: "bg-tint-lilac",
  hr: "bg-tint-teams",
  payroll: "bg-tint-slate",
  admin: "bg-tint-audit",
};

// One line on every card about what it needs or what needs it.
export const dependencyLine: Record<string, string> = {
  projects: "Used by Tasks",
  tasks: "Needs Projects",
  docs: "Works alone",
  dashboard: "Always on",
  settings: "Always on",
};

// Planned modules: named, dashed, never toggleable.
export const planned: Array<{ name: string; description: string; tint: TileTint }> = [
  {
    name: "Files",
    description: "Store a file once and attach it anywhere.",
    tint: "projects",
  },
  {
    name: "Chat",
    description: "Channels and threads next to the work.",
    tint: "teams",
  },
  {
    name: "Meetings",
    description: "Agendas and notes that turn into tasks.",
    tint: "docs",
  },
  {
    name: "Calendar",
    description: "Team calendars tied to due dates.",
    tint: "tasks",
  },
  {
    name: "Dashboards",
    description: "Charts built from your projects and tasks.",
    tint: "audit",
  },
  {
    name: "Forms",
    description: "Collect requests that turn into tasks.",
    tint: "sun",
  },
];

export const plannedTint: Record<TileTint, string> = {
  projects: "bg-tint-projects",
  tasks: "bg-tint-tasks",
  docs: "bg-tint-docs",
  teams: "bg-tint-teams",
  audit: "bg-tint-audit",
  sun: "bg-tint-sun",
  lilac: "bg-tint-lilac",
  slate: "bg-tint-slate",
};

export type ModuleRow = {
  id: string;
  name: string;
  description: string;
  icon: string;
  core: boolean;
  enabled: boolean;
  canToggle: boolean;
  reason: string | null;
};

export type ModuleList = {
  canManage: boolean;
  modules: ModuleRow[];
};
