import { LEGAL } from "./site-data-legal-docs";

export { LEGAL };

export const CL = [
  [
    "Oct 13, 2026",
    "Docs follow workspace roles",
    "Viewing, editing and sharing a doc now use the same roles as every other module. Only Owners and Admins can share a doc outside the org.",
    "Docs",
  ],
  [
    "Oct 8, 2026",
    "Focus timer on Today",
    "Start a timer on any task from Today. Tracked time shows on the task and on your day.",
    "Tasks",
  ],
  [
    "Oct 1, 2026",
    "Module dependencies",
    "Turning off a module that another one needs now asks first. For example, Tasks needs Projects.",
    "Modules",
  ],
  [
    "Sep 24, 2026",
    "Invite with a role and team",
    "Invite people by email and set their role and team in the same step.",
    "Teams",
  ],
  [
    "Sep 17, 2026",
    "Command palette",
    "Press ⌘K to search tasks, docs and people, or jump to any page.",
    "Workspace",
  ],
  [
    "Sep 10, 2026",
    "Filter the audit log",
    "Filter entries by person, module and date range.",
    "Audit log",
  ],
  [
    "Sep 2, 2026",
    "Bulk edit tasks",
    "Select several tasks to change their state, assignee or due date at once.",
    "Tasks",
  ],
  [
    "Aug 26, 2026",
    "Project keys",
    "Each project gets a short key, and its tasks are numbered from it, like ZEN-18.",
    "Projects",
  ],
  [
    "Aug 19, 2026",
    "Guest role",
    "Invite people from outside the company as Guests. They see only what is shared with them.",
    "Roles",
  ],
];

export const CLCHIP: Record<string, string | null> = {
  Docs: "Knowledge",
  Tasks: "Work",
  Projects: "Work",
  Modules: "Company",
  Teams: "Company",
  "Audit log": "Company",
  Roles: "Company",
  Workspace: null,
};

export const TOPICS = [
  "Sales",
  "Support",
  "Security",
  "Billing",
  "Press",
  "Other",
];
