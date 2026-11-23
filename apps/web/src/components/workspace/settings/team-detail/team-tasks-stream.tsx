import Link from "next/link";
import { StatusGlyph } from "@kyren/ui/components/status-glyph";
import { DueDate } from "~/src/components/due-date";
import { paths } from "~/src/lib/paths";
import type { WorkloadData } from "./types";

export function TeamTasksStream({
  workload,
}: {
  workload: WorkloadData | null;
}) {
  return (
    <section aria-labelledby="team-task-stream" className="flex flex-col">
      <div className="flex items-center justify-between pb-2">
        <h2
          id="team-task-stream"
          className="flex items-center gap-2 font-semibold"
        >
          Cross-Project Tasks
          <span className="font-mono text-xs font-normal text-ink-3">
            {workload?.tasks.length ?? 0}
          </span>
        </h2>
        {workload && workload.totalTasks > 0 ? (
          <span className="font-mono text-xs text-ink-3">
            {workload.openTasksCount} open · {workload.doneTasksCount} done
          </span>
        ) : null}
      </div>

      {workload && workload.tasks.length > 0 ? (
        <div className="flex flex-col">
          {workload.tasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-2.5 border-b border-hairline/60 px-1 py-2 hover:bg-hover transition-colors"
            >
              <StatusGlyph status={task.status} size={12} decorative />
              <Link
                href={paths.task(task.key)}
                className="font-mono text-xs font-medium text-ink-2 hover:text-ink shrink-0"
              >
                {task.key}
              </Link>
              <Link
                href={paths.task(task.key)}
                className="min-w-0 truncate text-sm text-ink hover:underline"
              >
                {task.name}
              </Link>
              <div className="ml-auto flex items-center gap-2.5 shrink-0">
                <Link
                  href={paths.project(task.projectSlug)}
                  className="rounded border border-hairline/80 bg-sunken px-1.5 py-0.5 font-mono text-[10px] text-ink-2 hover:text-ink hover:border-hairline"
                >
                  {task.projectName}
                </Link>
                {task.dueAt ? (
                  <DueDate
                    value={task.dueAt}
                    done={task.status === "done"}
                  />
                ) : null}
                {task.assigneeName ? (
                  <span className="hidden sm:inline-block max-w-[80px] truncate font-mono text-[11px] text-ink-3">
                    {task.assigneeName}
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="py-3 text-sm text-ink-2">
          No tasks assigned to this team or its members yet.
        </p>
      )}
    </section>
  );
}
