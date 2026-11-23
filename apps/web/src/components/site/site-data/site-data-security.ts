export const ROLES = [
  [
    "Owner",
    "Everything, including roles, billing and turning modules on or off.",
  ],
  [
    "Admin",
    "Manages members and teams, shares docs outside the org and reads the audit log.",
  ],
  ["Member", "Creates and edits work in the projects they can see."],
  ["Guest", "Sees only the projects and docs shared with them."],
];

export const MATRIX = [
  ["Projects", "view", [2, 2, 2, 3]],
  ["Projects", "edit", [2, 2, 1, 0]],
  ["Tasks", "create", [2, 2, 2, 0]],
  ["Tasks", "assign others", [2, 2, 2, 0]],
  ["Docs", "edit", [2, 2, 2, 3]],
  ["Docs", "share outside org", [2, 2, 0, 0]],
  ["Teams", "manage members", [2, 2, 0, 0]],
  ["Roles", "change", [2, 0, 0, 0]],
  ["Audit log", "view", [2, 2, 0, 0]],
  ["Modules", "turn on or off", [2, 0, 0, 0]],
];

export const CHAIN = [
  [
    "Workspace role",
    "Owner, Admin, Member or Guest. It sets what a person can do in every module.",
  ],
  [
    "Project access",
    "A project decides who can see it. Its tasks and docs inherit that access.",
  ],
  [
    "Item sharing",
    "Share one doc or task with a guest. They get that item and nothing else.",
  ],
  [
    "Search",
    "Search returns only what you are allowed to see, in every module.",
  ],
  ["Audit log", "Each change above is written to the log."],
];

export const AUDIT = [
  [
    "Oct 14 · 11:20",
    "Mira Okafor",
    "shared “Onboarding checklist v2 — spec” with Growth team",
    "Docs",
  ],
  [
    "Oct 14 · 11:02",
    "Tomás Reyes",
    "invited 2 guests to Onboarding v2",
    "Teams",
  ],
  [
    "Oct 14 · 10:31",
    "Priya Shah",
    "removed “Modules · turn on or off” from Admin",
    "Roles",
  ],
  ["Oct 14 · 10:05", "Mira Okafor", "moved ZEN-142 to In progress", "Tasks"],
  ["Oct 14 · 09:40", "Jonas Lind", "turned on Tasks for Fernway", "Modules"],
  ["Oct 14 · 09:12", "Priya Shah", "gave Member edit access to Docs", "Roles"],
];

export const COMP = [
  "Web app",
  "Sign-in",
  "Search",
  "Projects",
  "Tasks",
  "Docs",
  "Teams",
  "Roles & permissions",
  "Audit log",
  "Email notifications",
];

export const INC = [
  [
    "11:20",
    "Monitoring",
    "A fix is live and search results load normally for most workspaces. We are watching it.",
  ],
  [
    "10:58",
    "Identified",
    "One search index node is slow to respond. We are moving traffic to healthy nodes.",
  ],
  [
    "10:42",
    "Investigating",
    "Search results are slow to load for some workspaces. Other modules are not affected.",
  ],
];
