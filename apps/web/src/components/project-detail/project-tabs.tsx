"use client";

import { Button } from "@kyren/ui/shadcn/button";
import Link from "next/link";
import { FC, useState, type ReactNode } from "react";

import { cn } from "@kyren/ui/lib/utils";

import { ActivityFeed } from "~/src/components/workspace/activity/activity-feed";
import type { WorkspaceTask } from "~/src/features/tasks/lib/types";
import { CriticalPathVisualizer } from "./critical-path-visualizer";
import { TimelineGanttVisualizer } from "./timeline-gantt-visualizer";
import { ProjectDocsList, ProjectTasks } from "./project-tab-views";

type Props = {
  projectId: string;
  projectSlug: string;
  description?: string | null;
  tasks: WorkspaceTask[];
  totalDocs: number;
  showTasks?: boolean;
  showDocs?: boolean;
  /** Beside every tab: details and the Thread. */
  aside?: ReactNode;
  /** The Overview's brief: who leads it, when it last changed, who works on it. */
  brief?: {
    owner: string;
    updatedAt: Date;
    editHref?: string | null;
    contributors: ReactNode;
  };
};

type TabId = "overview" | "tasks" | "timeline" | "graph" | "docs" | "activity";

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-hairline/80 bg-surface/80 p-6 shadow-2xs">
      <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}

export const ProjectTabs: FC<Props> = ({
  projectId,
  projectSlug,
  description,
  tasks,
  totalDocs,
  showTasks = true,
  showDocs = true,
  aside,
  brief,
}) => {
  const [tab, setTab] = useState<TabId>("overview");

  const tabs: Array<{
    id: TabId;
    label: string;
    count?: number;
  }> = [
    { id: "overview", label: "Overview" },
    ...(showTasks
      ? [
          {
            id: "tasks" as const,
            label: "Tasks",
            count: tasks.length,
          },
          {
            id: "timeline" as const,
            label: "Timeline (Gantt)",
          },
          {
            id: "graph" as const,
            label: "Critical Path",
          },
        ]
      : []),
    ...(showDocs
      ? [
          {
            id: "docs" as const,
            label: "Docs",
            count: totalDocs,
          },
        ]
      : []),
    { id: "activity", label: "Activity" },
  ];

  return (
    <div className="w-full">
      <div
        role="tablist"
        aria-label="Project sections"
        className="tab-scroll flex gap-5 border-b border-hairline text-[15px]"
      >
        {tabs.map(({ id, label, count }) => (
          <Button
            variant="custom"
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              "-mb-px flex items-center gap-1.5 border-b-2 py-2.5 whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors",
              tab === id
                ? "border-signal font-medium text-ink"
                : "border-transparent text-ink-2 hover:text-ink",
            )}
          >
            {label}
            {count !== undefined ? (
              <span className="font-mono text-xs text-ink-3">{count}</span>
            ) : null}
          </Button>
        ))}
        {/* Planned: shown dim so the tab bar tells the truth. */}
        <span
          aria-disabled="true"
          className="-mb-px flex items-center gap-1.5 border-b-2 border-transparent py-2.5 whitespace-nowrap text-ink-3"
        >
          Files
          <span className="rounded-lg border border-dashed border-hairline px-1.5 font-mono text-[11px]">
            Coming
          </span>
        </span>
      </div>

      <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div role="tabpanel" className="min-w-0">
          {tab === "overview" ? (
            <div className="flex flex-col gap-7">
              <section
                aria-label="Project brief"
                className="flex flex-col gap-4 rounded-2xl border border-hairline/80 bg-surface/80 p-6 shadow-2xs"
              >
                <div className="flex flex-wrap items-baseline gap-2.5 pb-2 border-b border-hairline/60">
                  <h2 className="text-[15px] font-semibold text-ink">
                    Project brief
                  </h2>
                  {brief ? (
                    <span className="font-mono text-xs text-ink-3">
                      {brief.owner} · updated{" "}
                      {brief.updatedAt.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  ) : null}
                  <span className="flex-1" />
                  {brief?.editHref ? (
                    <Link
                      href={brief.editHref}
                      className="rounded-xs text-[13px] text-signal hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      Edit
                    </Link>
                  ) : null}
                </div>
                {description ? (
                  <div className="flex flex-col gap-3 text-[15px] leading-6 whitespace-pre-line">
                    {description}
                  </div>
                ) : (
                  <p className="text-[15px] leading-6 text-ink-3">
                    No brief yet. Write the goal, what is in and out of scope,
                    and when this project is done.
                  </p>
                )}
              </section>
              {brief?.contributors}
            </div>
          ) : null}

          {tab === "tasks" ? (
            <ProjectTasks tasks={tasks} projectSlug={projectSlug} />
          ) : null}

          {tab === "timeline" ? (
            <TimelineGanttVisualizer projectSlug={projectSlug} tasks={tasks} />
          ) : null}

          {tab === "graph" ? (
            <CriticalPathVisualizer projectSlug={projectSlug} />
          ) : null}

          {tab === "docs" ? <ProjectDocsList projectId={projectId} /> : null}

          {tab === "activity" ? (
            <Panel title="Activity">
              <ActivityFeed
                selector={{ projectId }}
                emptyText="Nothing has happened in this project yet."
              />
            </Panel>
          ) : null}
        </div>
        {aside ? (
          <aside className="flex min-w-0 flex-col gap-4">{aside}</aside>
        ) : null}
      </div>
    </div>
  );
};
