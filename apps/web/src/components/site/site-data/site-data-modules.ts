import { GROUPS as catalog } from "../../landing-page/landing-groups";
/* eslint-disable @typescript-eslint/no-explicit-any */
export const MODS: Array<[string, string, string, number, string]> = catalog.flatMap(
  ([group,,tiles]) => tiles.map(([name, code, description]): [string,string,string,number,string] => [name,code,group,1,description])
);
export const MODBY: Record<string, (typeof MODS)[number]> = Object.fromEntries(
  MODS.map((x) => [x[0], x]),
);

export const MD: Record<string, any> = {
  tasks: {
    n: "Tasks",
    code: "Ta",
    group: "Work",
    h1a: "Tasks that know where they ",
    h1em: "came",
    h1b: " from.",
    lead: "Every task has a key, a state, an assignee, a due date and a timer. It links to its project, its doc and the people on it, and every change goes to the audit log.",
    url1: "northwind.zentro.app / tasks",
    url2: "northwind.zentro.app / tasks / ZEN-18",
    url3: "northwind.zentro.app / today",
    s1t: "Task list",
    s1d: "Grouped by state. Filter by project or person, or switch to a board.",
    s2t: "Task detail",
    s2d: "Properties at the top and every linked item down the Thread.",
    s3t: "Today",
    s3d: "Your focus task with its timer, and what is up next.",
    links: [
      [
        "Projects",
        1,
        "Every task belongs to a project and takes its key from it, like ZEN-18. Project access decides who sees the task.",
      ],
      [
        "Docs",
        1,
        "Link the spec a task was written from. The doc lists every task that points to it.",
      ],
      ["Teams", 1, "Assign tasks to people and filter the list by team."],
      [
        "Roles & permissions",
        1,
        "Who can create, assign and edit tasks comes from the workspace roles.",
      ],
      [
        "Audit log",
        1,
        "State changes, reassignments and edits are written to the log.",
      ],
      ["Files", 0, "Attach a file once and see it on every task that uses it."],
      ["Chat", 0, "Link the message that changed a task."],
      ["Tickets", 0, "Link the support ticket a task fixes."],
    ],
    perms: [
      ["view", [2, 2, 2, 3]],
      ["create", [2, 2, 2, 0]],
      ["edit", [2, 2, 1, 0]],
      ["assign others", [2, 2, 2, 0]],
      ["delete", [2, 2, 1, 0]],
    ],
    closeLead:
      "Tasks is live today, with Projects, Docs, Teams, roles and the audit log.",
  },
  docs: {
    n: "Docs",
    code: "Dc",
    group: "Knowledge",
    h1a: "Docs that link to the ",
    h1em: "work",
    h1b: " they describe.",
    lead: "Write specs, decisions and notes next to the tasks they belong to. A doc shows its linked tasks, follows its project’s access, and every edit and share goes to the audit log.",
    url1: "northwind.zentro.app / docs",
    url2: "northwind.zentro.app / docs / session-handling-spec",
    url3: "northwind.zentro.app / docs / share",
    s1t: "Docs home",
    s1d: "Every doc with its project, linked tasks and last edit.",
    s2t: "Doc editor",
    s2d: "Headings, checklists and code, with linked tasks under the text.",
    s3t: "Sharing",
    s3d: "Share with a team or a person. Sharing outside the org follows the roles.",
    links: [
      [
        "Tasks",
        1,
        "Link a doc to the tasks it describes. Each task shows the doc it came from.",
      ],
      ["Projects", 1, "A doc lives in a project and follows its access."],
      ["Teams", 1, "Share a doc with a whole team in one step."],
      [
        "Roles & permissions",
        1,
        "Viewing, editing and sharing outside the org follow the workspace roles.",
      ],
      [
        "Audit log",
        1,
        "Edits, shares and permission changes are written to the log.",
      ],
      ["Files", 0, "Embed a stored file in a doc without uploading a copy."],
      ["Meetings", 0, "Turn meeting notes into a doc."],
      ["Chat", 0, "Link the thread a decision came from."],
    ],
    perms: [
      ["view", [2, 2, 2, 3]],
      ["create", [2, 2, 2, 0]],
      ["edit", [2, 2, 2, 3]],
      ["share outside org", [2, 2, 0, 0]],
      ["delete", [2, 2, 1, 0]],
    ],
    closeLead:
      "Docs is live today, with Projects, Tasks, Teams, roles and the audit log.",
  },
};

export const TL = [
  [
    "prog",
    "In progress",
    [
      [
        "ZEN-18",
        "Fix login redirect loop on expired sessions",
        "PR",
        "Tomorrow",
      ],
      ["BIL-7", "Migrate invoices table to integer cents", "AM", "Oct 11", 1],
      ["ONB-12", "Write welcome email copy", "MI", "Oct 17"],
    ],
  ],
  [
    "review",
    "In review",
    [
      ["BIL-4", "Proration rules for mid-cycle upgrades", "AM", "Oct 14"],
      ["ZEN-15", "Empty states for Docs home", "PR", "Oct 20"],
    ],
  ],
  [
    "todo",
    "To do",
    [
      ["ONB-14", "Invite teammates step", "MI", "Oct 12", 1],
      ["ZEN-24", "Rate-limit the invite endpoint", "TB", "Oct 15"],
      ["ONB-9", "Checklist progress on Today", "MI", "Oct 22"],
    ],
  ],
];

export const PROJ: Record<string, string> = {
  ZEN: "Zentro Web",
  BIL: "Billing",
  ONB: "Onboarding",
};

export const PREV: Record<string, string[][]> = {
  Dashboards: [
    ["Open tasks by project", "Bar chart"],
    ["Overdue this week", "Number"],
    ["Done per person", "Table"],
  ],
  Forms: [
    ["Bug report", "Creates a task in Zentro Web"],
    ["Access request", "Goes to Admins"],
    ["Time off request", "Goes to HR"],
  ],
  Files: [
    ["checklist-flow-v3.pdf", "4.2 MB · ZEN-142"],
    ["brand-kit.zip", "18 MB · Marketing"],
    ["q4-plan.xlsx", "96 KB · Company"],
  ],
  Chat: [
    ["#onboarding", "Can we skip step 4 for invited users?"],
    ["#eng", "Deploying the session fix at 3pm."],
    ["#general", "Office closed on Friday."],
  ],
  Meetings: [
    ["Product sync", "Oct 13 · 25 min · 3 tasks"],
    ["Hiring review", "Oct 14 · 40 min"],
    ["Weekly planning", "Oct 16 · 30 min"],
  ],
  Mail: [
    ["support@", "Invoice question from a customer"],
    ["hello@", "Partnership enquiry"],
    ["jobs@", "Application: product designer"],
  ],
  Calendar: [
    ["Release onboarding v2", "Oct 18 · from ZEN-142"],
    ["Product sync", "Thu 10:00"],
    ["Q4 planning", "Oct 28"],
  ],
  Tickets: [
    ["SUP-88", "Invited users see an empty checklist"],
    ["SUP-91", "Export button missing on mobile"],
    ["SUP-93", "Wrong time zone on due dates"],
  ],
  Admin: [
    ["Workspace name", "Fernway"],
    ["Domains", "fernway.com"],
    ["Billing contact", "Owner"],
  ],
  HR: [
    ["Mira Okafor", "Product · Growth team"],
    ["Jonas Lind", "Design · Growth team"],
    ["Time off", "2 requests waiting"],
  ],
  Payroll: [
    ["October run", "Draft · 24 people"],
    ["September run", "Paid"],
    ["Payslips", "From HR records"],
  ],
};
