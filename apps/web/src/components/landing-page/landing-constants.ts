import { moduleRegistry } from "@zentro/modules";
export const KEYS = [
  "hero",
  "s2a",
  "s2b",
  "s2c",
  "s3a",
  "s3b",
  "s4",
  "s5",
  "s5x",
  "s6a",
  "s6b",
  "s6c",
] as const;

export type ThreadKey = (typeof KEYS)[number];

// Segments that draw horizontally, and from which side.
export const HORIZONTAL: Partial<Record<ThreadKey, "left" | "right">> = {
  s2b: "left",
  s3b: "right",
  s5x: "left",
  s6b: "left",
};

// name, width, scattered x, scattered y, rotation
export const CHIPS: Array<[string, number, number, number, number]> = [
  ["tracker", 85, 10, 20, -8],
  ["wiki", 61, 210, 0, 6],
  ["drive", 69, 330, 60, -4],
  ["chat", 61, 60, 120, 10],
  ["mail", 61, 250, 130, -12],
  ["calendar", 92, 0, 250, 5],
  ["HR", 46, 180, 230, -6],
  ["payroll", 85, 300, 280, 8],
  ["support", 85, 80, 340, -5],
  ["forms", 69, 260, 360, 12],
];

type Preview = Array<[string, string, string, string]>;

export const PREVIEWS: Record<string, Preview> = {
  proj: [
    ["Onboarding v2", "12 tasks", "In progress", "var(--amber)"],
    ["Docs permissions", "8 tasks", "In review", "var(--cyan)"],
    ["Roles migration", "6 tasks", "Done", "var(--green)"],
  ],
  roles: [
    ["Owner", "2 people", "Everything", ""],
    ["Admin", "3 people", "Manage modules", ""],
    ["Member", "14 people", "Own work", ""],
    ["Guest", "5 people", "Shared items", ""],
  ],
  docs: [
    ["Onboarding checklist v2 — spec", "ZEN-142", "Edited 2h ago", ""],
    ["Q4 hiring plan", "ZEN-120", "Shared with Guests", ""],
  ],
};

export const MATRIX: Array<[string, string, number[]]> = [
  ["Projects", "view", [2, 2, 2, 1]],
  ["Projects", "edit", [2, 2, 1, 0]],
  ["Tasks", "create", [2, 2, 2, 0]],
  ["Tasks", "assign others", [2, 2, 2, 0]],
  ["Docs", "edit", [2, 2, 2, 1]],
  ["Docs", "share outside org", [2, 2, 0, 0]],
  ["Teams", "manage members", [2, 2, 0, 0]],
  ["Roles", "change", [2, 0, 0, 0]],
  ["Audit log", "view", [2, 2, 0, 0]],
  ["Modules", "turn on or off", [2, 0, 0, 0]],
];

export const AUDIT: Array<[string, string, string]> = [
  ["09:12", "Priya Shah", "gave Member edit access to Docs"],
  ["09:40", "Jonas Lind", "turned on Tasks for Fernway"],
  ["10:05", "Mira Okafor", "moved ZEN-142 to In progress"],
  ["10:31", "Priya Shah", "removed “Modules · turn on or off” from Admin"],
  ["11:02", "Tomás Reyes", "invited 2 guests to Onboarding v2"],
];

export const PULSE: Array<[string, string, string, string, string]> = [
  [
    "MO",
    "Mira Okafor",
    "ZEN-142 · onboarding checklist",
    "var(--amber)",
    "var(--lav)",
  ],
  [
    "JL",
    "Jonas Lind",
    "ZEN-138 · roles migration",
    "var(--cyan)",
    "var(--sky)",
  ],
  [
    "PS",
    "Priya Shah",
    "ZEN-131 · docs share settings",
    "var(--green)",
    "var(--mint)",
  ],
  [
    "TR",
    "Tomás Reyes",
    "ZEN-127 · audit log export",
    "var(--rose)",
    "var(--peach)",
  ],
];

export const FOOT_LIVE = moduleRegistry.map((module) => module.name);
