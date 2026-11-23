export type TodayTask = {
  id: string;
  key: string;
  name: string;
  status: string;
  priority: string;
  dueAt: string | null;
  createdAt: string;
  projectName: string;
  projectSlug: string;
  href: string;
};

export type TodayPulseItem = {
  id: string;
  actor: string;
  verb: "started" | "moved" | "finished" | "created";
  taskKey: string;
  title: string;
  href: string;
  at: string;
};

export type TodayData = {
  memberId: string | null;
  /** The person's running timer, if any. Pausing stops it and logs the time. */
  timer: { taskKey: string; startedAt: string } | null;
  tasks: TodayTask[];
  /** Tasks this person finished since midnight. */
  doneToday: number;
  pulse: TodayPulseItem[];
  /** Task events per day for the last seven days, oldest first. */
  week: Array<{ label: string; count: number }>;
  /** The top open task nobody owns, offered when nothing is left. */
  unassignedNext: { key: string; name: string } | null;
  /** Whether the organization has any task this person can see. */
  hasAnyTasks: boolean;
};

export const weekdayLetter = ["S", "M", "T", "W", "T", "F", "S"];

export type StatusChange = { changes?: Array<{ to?: string | null }> };

export function verbFor(action: string, metadata: StatusChange) {
  if (action === "task.created") return "created" as const;

  const to = metadata?.changes?.[0]?.to;

  if (to === "in-progress") return "started" as const;
  if (to === "done") return "finished" as const;

  return "moved" as const;
}
