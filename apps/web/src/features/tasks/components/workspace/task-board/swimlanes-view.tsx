"use client";

import { Button } from "@kyren/ui/shadcn/button";
import type { DragEvent, FC } from "react";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { StatusGlyph } from "@kyren/ui/components/status-glyph";
import { statusLabels } from "~/src/features/tasks/lib/constants";
import type { TaskStatus, WorkspaceTask } from "~/src/features/tasks/lib/types";
import { TaskCard } from "./../task-card";
import type { Swimlane } from "./types";

export const SwimlanesView: FC<{
  shown: TaskStatus[];
  tasks: WorkspaceTask[];
  swimlanes: Swimlane[];
  collapsedLanes: Record<string, boolean>;
  onToggleLane: (laneId: string) => void;
  onDrop: (event: DragEvent<HTMLElement>, status: TaskStatus) => void;
  canChangeStatus: boolean;
}> = ({
  shown,
  tasks,
  swimlanes,
  collapsedLanes,
  onToggleLane,
  onDrop,
  canChangeStatus,
}) => {
  return (
    <div className="overflow-x-auto pb-4">
      {/* Sticky Swimlane Column Headers */}
      <div
        className="sticky top-0 z-10 mb-3 grid min-w-[880px] gap-3 rounded-2xl border border-hairline/80 bg-canvas/90 px-3 py-2.5 backdrop-blur shadow-2xs dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]"
        style={{
          gridTemplateColumns: `repeat(${shown.length}, minmax(0, 1fr))`,
        }}
      >
        {shown.map((status) => {
          const count = tasks.filter((t) => t.status === status).length;
          return (
            <div key={status} className="flex items-center gap-2 px-1">
              <StatusGlyph status={status} size={13} decorative />
              <span className="text-[13px] font-semibold text-ink">
                {statusLabels[status]}
              </span>
              <span className="rounded-full bg-surface border border-hairline px-2 py-0.5 font-mono text-[11px] font-medium text-ink-3">
                {count}
              </span>
            </div>
          );
        })}
      </div>

      {/* Swimlane Rows */}
      <div className="flex flex-col gap-3 min-w-[880px]">
        {swimlanes.map((lane) => {
          const isCollapsed = collapsedLanes[lane.id] ?? false;

          return (
            <div
              key={lane.id}
              className="rounded-2xl border border-hairline/70 bg-surface/40 p-3 shadow-2xs transition-colors hover:border-hairline"
            >
              {/* Lane Header Bar */}
              <Button
                type="button"
                variant="custom"
                aria-expanded={!isCollapsed}
                onClick={() => onToggleLane(lane.id)}
                className="w-full flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition-colors cursor-pointer select-none hover:bg-hover/60"
              >
                <span className="text-ink-3">
                  {isCollapsed ? (
                    <ChevronRightIcon className="size-4" />
                  ) : (
                    <ChevronDownIcon className="size-4" />
                  )}
                </span>
                {lane.icon}
                <span className="text-xs font-semibold text-ink">
                  {lane.title}
                </span>
                <span className="rounded-full bg-surface border border-hairline px-2 py-0.5 font-mono text-[11px] font-medium text-ink-3">
                  {lane.tasks.length}{" "}
                  {lane.tasks.length === 1 ? "task" : "tasks"}
                </span>
                {lane.totalPoints > 0 ? (
                  <span className="font-mono text-[10px] text-ink-3">
                    · {lane.totalPoints} pts
                  </span>
                ) : null}

                {/* Collapsed mini status breakdown */}
                {isCollapsed && (
                  <span className="ml-auto flex items-center gap-2">
                    {shown.map((status) => {
                      const cnt = lane.tasks.filter(
                        (t) => t.status === status,
                      ).length;
                      if (!cnt) return null;
                      return (
                        <span
                          key={status}
                          className="flex items-center gap-1 font-mono text-[10px] text-ink-3"
                        >
                          <StatusGlyph status={status} size={10} decorative />
                          {cnt}
                        </span>
                      );
                    })}
                  </span>
                )}
              </Button>

              {/* Expanded Lane Grid */}
              {!isCollapsed && (
                <div
                  className="mt-2.5 grid items-start gap-3"
                  style={{
                    gridTemplateColumns: `repeat(${shown.length}, minmax(0, 1fr))`,
                  }}
                >
                  {shown.map((status) => {
                    const laneStatusTasks = lane.tasks.filter(
                      (task) => task.status === status,
                    );

                    return (
                      <div
                        key={status}
                        aria-label={`${lane.title} - ${statusLabels[status]}`}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => onDrop(event, status)}
                        className="flex min-h-[100px] flex-col gap-2 rounded-xl border border-hairline/40 bg-canvas/30 p-2 transition-colors hover:border-hairline"
                      >
                        {laneStatusTasks.length ? (
                          laneStatusTasks.map((task) => (
                            <div
                              key={task.id}
                              draggable={canChangeStatus}
                              onDragStart={(event) => {
                                event.dataTransfer.effectAllowed = "move";
                                event.dataTransfer.setData(
                                  "text/plain",
                                  task.id,
                                );
                              }}
                            >
                              <TaskCard task={task} />
                            </div>
                          ))
                        ) : (
                          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-hairline/60 p-3 text-center text-[11px] text-ink-3/60">
                            Drop here
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
