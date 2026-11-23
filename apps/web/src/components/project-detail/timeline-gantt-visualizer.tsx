"use client";

import { useEffect, useMemo, useState, type FC } from "react";
import { useTrpcClient } from "@zentro/api/react";
import { cn } from "@zentro/ui/lib/utils";
import type { WorkspaceTask } from "~/src/features/tasks/lib/types";

import type { DependencyGraphData, TimelineScale } from "./timeline/types";
import { TimelineControls } from "./timeline/timeline-controls";
import { GanttRow } from "./timeline/gantt-row";
import { SelectedTaskBar } from "./timeline/selected-task-bar";
import { useTimelineLayout } from "./timeline/use-timeline-layout";

type Props = {
  projectSlug: string;
  tasks: WorkspaceTask[];
};

export const TimelineGanttVisualizer: FC<Props> = ({ projectSlug, tasks }) => {
  const trpc = useTrpcClient();
  const [scale, setScale] = useState<TimelineScale>("days");
  const [search, setSearch] = useState("");
  const [highlightCritical, setHighlightCritical] = useState(false);
  const [selectedTaskKey, setSelectedTaskKey] = useState<string | null>(null);
  const [offsetWeeks, setOffsetWeeks] = useState(0);
  const [depData, setDepData] = useState<DependencyGraphData | null>(null);

  useEffect(() => {
    let isMounted = true;
    trpc.project.getDependencyGraph
      .query({ slug: projectSlug })
      .then((res) => {
        if (isMounted) {
          setDepData(res as unknown as DependencyGraphData);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [projectSlug, trpc]);

  const criticalSet = useMemo(() => {
    return new Set(depData?.criticalPath ?? []);
  }, [depData]);

  const { timeBuckets, timelineTasks } = useTimelineLayout({
    tasks,
    scale,
    offsetWeeks,
    criticalSet,
  });

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return timelineTasks.filter((t) => {
      if (highlightCritical && !t.isCritical) return false;
      if (!q) return true;
      return (
        t.key.toLowerCase().includes(q) ||
        t.title.toLowerCase().includes(q) ||
        t.assignee.toLowerCase().includes(q)
      );
    });
  }, [timelineTasks, search, highlightCritical]);

  const selectedTask = useMemo(() => {
    if (!selectedTaskKey) return null;
    return timelineTasks.find((t) => t.key === selectedTaskKey) ?? null;
  }, [timelineTasks, selectedTaskKey]);

  return (
    <div className="flex flex-col gap-4">
      <TimelineControls
        search={search}
        onSearchChange={setSearch}
        scale={scale}
        onScaleChange={setScale}
        highlightCritical={highlightCritical}
        onToggleHighlightCritical={() => setHighlightCritical((prev) => !prev)}
        criticalCount={criticalSet.size}
        setOffsetWeeks={setOffsetWeeks}
      />

      {/* Main Gantt Grid Container */}
      <div className="overflow-x-auto rounded-2xl border border-hairline/80 bg-surface/50 shadow-2xs">
        <div className="min-w-[960px]">
          {/* Header Row: Task metadata label on left, timeline buckets on right */}
          <div className="grid grid-cols-[280px_minmax(0,1fr)] border-b border-hairline/80 bg-surface/90">
            <div className="flex items-center justify-between px-4 py-2.5 border-r border-hairline text-xs font-semibold text-ink">
              <span>Task & Milestone</span>
              <span className="font-mono text-[10px] text-ink-3">
                {filteredTasks.length}{" "}
                {filteredTasks.length === 1 ? "item" : "items"}
              </span>
            </div>

            {/* Timeline Column Headers */}
            <div
              className="grid"
              style={{
                gridTemplateColumns: `repeat(${timeBuckets.length}, minmax(0, 1fr))`,
              }}
            >
              {timeBuckets.map((bucket, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "flex flex-col items-center justify-center py-1.5 border-r border-hairline/40 text-center transition-colors",
                    bucket.isToday &&
                      "bg-signal-subtle/50 font-semibold text-signal",
                  )}
                >
                  <span className="text-[10px] uppercase text-ink-3 leading-tight">
                    {bucket.label}
                  </span>
                  <span
                    className={cn(
                      "font-mono text-[11px] leading-tight",
                      bucket.isToday ? "text-signal font-bold" : "text-ink",
                    )}
                  >
                    {bucket.subLabel}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Task Rows */}
          <div className="divide-y divide-hairline/50">
            {filteredTasks.length === 0 ? (
              <div className="py-12 text-center text-xs text-ink-3">
                No tasks match the active timeline filter.
              </div>
            ) : (
              filteredTasks.map((task) => (
                <GanttRow
                  key={task.id}
                  task={task}
                  timeBuckets={timeBuckets}
                  isSelected={selectedTaskKey === task.key}
                  onSelect={() =>
                    setSelectedTaskKey(
                      selectedTaskKey === task.key ? null : task.key,
                    )
                  }
                />
              ))
            )}
          </div>
        </div>
      </div>

      {selectedTask && <SelectedTaskBar selectedTask={selectedTask} />}
    </div>
  );
};
