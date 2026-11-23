export type Kind = "files" | "chat";

export const copy: Record<
  Kind,
  { name: string; headline: string; body: string; planned: string }
> = {
  files: {
    name: "Files",
    headline: "Files is on its way.",
    body: "Upload a file once and attach it to any task, doc or project. It joins the Thread like everything else, so you can always see where it’s used.",
    planned: "Planned for early 2027",
  },
  chat: {
    name: "Chat",
    headline: "Chat is on its way.",
    body: "Channels and threads that sit next to the work they’re about. Mention a task key in a message and it links both ways.",
    planned: "Planned for 2027",
  },
};

export const storageKey = (kind: Kind) => `kyren:notify:${kind}`;

export const files = [
  {
    ext: "HAR",
    name: "session-trace.har",
    key: "ZEN-18",
    linked: "Fix login redirect loop",
    size: "2.1 MB",
    date: "Today",
    tint: "bg-tint-projects",
  },
  {
    ext: "XLS",
    name: "Q4 pricing scenarios.xlsx",
    key: "BIL-4",
    linked: "Proration rules",
    size: "640 KB",
    date: "Oct 13",
    tint: "bg-tint-teams",
  },
  {
    ext: "PDF",
    name: "Onboarding research.pdf",
    key: "ONB",
    linked: "Onboarding Flow",
    size: "8.4 MB",
    date: "Oct 11",
    tint: "bg-tint-docs",
  },
  {
    ext: "PNG",
    name: "Empty state v3.png",
    key: "ONB-14",
    linked: "Empty state for new…",
    size: "1.2 MB",
    date: "Oct 10",
    tint: "bg-tint-tasks",
  },
  {
    ext: "CSV",
    name: "churn-sept.csv",
    key: "BIL",
    linked: "Billing Revamp",
    size: "220 KB",
    date: "Oct 2",
    tint: "bg-tint-teams",
  },
];

export const channels = [
  "# platform",
  "# billing",
  "# onboarding",
  "# general",
  "Arjun Mehta",
];

export const messages = [
  {
    who: "Arjun Mehta",
    time: "10:02",
    body: "Redirect loop is back on staging after the cookie change.",
    link: {
      key: "ZEN-18",
      title: "Fix login redirect loop",
      status: "in-progress",
    },
  },
  {
    who: "Tom Becker",
    time: "10:04",
    body: "I can take it after standup. Is the trace in the task?",
  },
  {
    who: "Arjun Mehta",
    time: "10:05",
    body: "Yes, attached it to the Thread.",
  },
  {
    who: "Priya Raman",
    time: "10:11",
    body: "Let’s ship the fix behind a flag and watch the error rate.",
  },
];

export function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("");
}
