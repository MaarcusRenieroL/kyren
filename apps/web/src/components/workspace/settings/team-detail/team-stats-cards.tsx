import { cn } from "@zentro/ui/lib/utils";
import type { TeamDetailData } from "./types";
import { DAY } from "./types";

export function TeamStatsCards({
  tasks,
  docs,
}: {
  tasks: TeamDetailData["tasks"];
  docs: TeamDetailData["docs"];
}) {
  const now = Date.now();
  const open = tasks.filter((task) => task.status !== "done");
  const started = open.filter((task) => task.status === "in-progress").length;
  const done = tasks.length - open.length;
  const overdue = open.filter(
    (task) => task.due && new Date(task.due).getTime() < now,
  );
  const editedToday = docs.filter(
    (doc) => now - new Date(doc.updatedAt).getTime() < DAY,
  ).length;

  const stats = [
    { label: "Open tasks", value: open.length, note: `${started} in progress` },
    { label: "Done", value: done, note: `of ${tasks.length} tasks` },
    {
      label: "Overdue",
      value: overdue.length,
      note: overdue[0]
        ? `${overdue[0].key} · ${overdue[0].name}`
        : "Nothing late",
      tone: overdue.length > 0,
    },
    {
      label: "Docs",
      value: docs.length,
      note: `${editedToday} edited today`,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="flex min-w-0 flex-col gap-1 rounded-2xl border border-hairline/80 bg-surface/80 p-4 shadow-2xs transition-all hover:border-hairline hover:shadow-xs"
        >
          <span className="eyebrow text-ink-3">{stat.label}</span>
          <span
            className={cn(
              "font-mono text-3xl font-bold tracking-tight text-ink",
              stat.tone && "text-danger-text",
            )}
          >
            {stat.value}
          </span>
          <span className="truncate text-xs text-ink-3">{stat.note}</span>
        </div>
      ))}
    </div>
  );
}
