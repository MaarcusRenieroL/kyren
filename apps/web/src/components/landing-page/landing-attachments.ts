export type Attachment = {
  icon: string;
  tint: string;
  kind: string;
  title: string;
  meta: string;
  caption: string;
  live: boolean;
};

export const ATTACHMENTS: Attachment[] = [
  {
    icon: "Dc",
    tint: "var(--lav)",
    kind: "Doc",
    title: "Onboarding checklist v2 — spec",
    meta: "Docs · edited 2h ago by Priya Shah",
    caption: "The spec the task was written from.",
    live: true,
  },
  {
    icon: "Fl",
    tint: "var(--sky)",
    kind: "File",
    title: "checklist-flow-v3.pdf",
    meta: "4.2 MB · uploaded by Jonas Lind",
    caption: "The design file, one version for everyone.",
    live: true,
  },
  {
    icon: "Ch",
    tint: "var(--peach)",
    kind: "Chat message",
    title: "“Can we skip step 4 for invited users?”",
    meta: "#onboarding · Jonas Lind · Oct 12",
    caption: "The message that changed the scope.",
    live: true,
  },
  {
    icon: "Mt",
    tint: "var(--mint)",
    kind: "Meeting note",
    title: "Product sync — ship v2 behind a flag",
    meta: "Meetings · Oct 13 · 25 min",
    caption: "Where the decision was made.",
    live: true,
  },
  {
    icon: "Tk",
    tint: "var(--rosep)",
    kind: "Support ticket",
    title: "SUP-88 · Invited users see an empty checklist",
    meta: "Tickets · High · Oct 11",
    caption: "The ticket that started it.",
    live: true,
  },
];
