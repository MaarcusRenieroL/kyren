"use client";

import { Input } from "@zentro/ui/shadcn/input";
import Link from "next/link";
import { useState } from "react";
import { SearchIcon } from "lucide-react";

import { ListView } from "~/src/features/tasks/components/workspace/list-view";
import type { WorkspaceTask } from "~/src/features/tasks/lib/types";
import { paths } from "~/src/lib/paths";

export function ProjectTasks({
  tasks,
  projectSlug,
}: {
  tasks: WorkspaceTask[];
  projectSlug: string;
}) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const shown = needle
    ? tasks.filter(
        (task) =>
          task.title.toLowerCase().includes(needle) ||
          task.key.toLowerCase().includes(needle),
      )
    : tasks;
  const open = tasks.filter((task) => task.status !== "done").length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative h-8 w-full min-w-0 sm:w-60">
          <SearchIcon
            aria-hidden="true"
            className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-ink-3"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter tasks"
            aria-label="Filter tasks"
            className="h-full w-full rounded-xl border border-hairline bg-surface pr-2.5 pl-8 text-[13px] outline-none placeholder:text-ink-3 focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/22"
          />
        </div>
        <span className="font-mono text-xs text-ink-3">{open} open</span>
        <span className="flex-1" />
        <Link
          href={paths.tasksForProject(projectSlug)}
          className="text-[13px] text-signal hover:underline"
        >
          Open in Tasks
        </Link>
      </div>
      <ListView tasks={shown} />
    </div>
  );
}
