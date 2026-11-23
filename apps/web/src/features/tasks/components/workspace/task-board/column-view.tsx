"use client";

import { Button } from "@zentro/ui/shadcn/button";
import type { DragEvent, FC } from "react";
import { PlusIcon } from "lucide-react";
import { StatusGlyph } from "@zentro/ui/components/status-glyph";
import { statusLabels } from "~/src/features/tasks/lib/constants";
import type { TaskStatus, WorkspaceTask } from "~/src/features/tasks/lib/types";
import { CreateTaskModal } from "../../create-task-modal";
import { TaskCard } from "../task-card";
import { doneVisible } from "./types";

export const ColumnView: FC<{
  shown: TaskStatus[];
  tasks: WorkspaceTask[];
  showAllDone: boolean;
  setShowAllDone: (show: boolean) => void;
  onDrop: (event: DragEvent<HTMLElement>, status: TaskStatus) => void;
  onTaskCreated?: () => void | Promise<void>;
  canChangeStatus: boolean;
}> = ({
  shown,
  tasks,
  showAllDone,
  setShowAllDone,
  onDrop,
  onTaskCreated,
  canChangeStatus,
}) => {
  return (
    <div className="overflow-x-auto pb-2">
      <div
        className="grid min-w-[880px] items-start gap-3"
        style={{
          gridTemplateColumns: `repeat(${shown.length}, minmax(0, 1fr))`,
        }}
      >
        {shown.map((status) => {
          const allTasks = tasks.filter((task) => task.status === status);
          const hidden =
            status === "done" && !showAllDone
              ? Math.max(allTasks.length - doneVisible, 0)
              : 0;
          const columnTasks = hidden
            ? allTasks.slice(0, doneVisible)
            : allTasks;

          return (
            <section
              key={status}
              aria-label={statusLabels[status]}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => onDrop(event, status)}
              className="flex flex-col gap-2.5 rounded-2xl border border-hairline/70 bg-surface/40 p-3 shadow-2xs transition-colors hover:border-hairline"
            >
              <div className="flex h-8 items-center gap-2 px-1">
                <StatusGlyph status={status} size={13} decorative />
                <h2 className="text-[13px] font-semibold text-ink">
                  {statusLabels[status]}
                </h2>
                <span className="font-mono text-[11px] font-medium px-2 py-0.5 rounded-full bg-muted/70 text-ink-3">
                  {allTasks.length}
                </span>
                <span className="flex-1" />
                <CreateTaskModal
                  defaultStatus={status}
                  onTaskCreated={onTaskCreated}
                  trigger={
                    <Button
                      variant="custom"
                      type="button"
                      aria-label={`Create a task in ${statusLabels[status]}`}
                      className="flex size-6 items-center justify-center rounded-md text-ink-3 transition-colors outline-none hover:bg-hover hover:text-ink focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <PlusIcon className="size-3.5" aria-hidden="true" />
                    </Button>
                  }
                />
              </div>

              <div className="flex flex-col gap-2.5">
                {columnTasks.length ? (
                  columnTasks.map((task) => (
                    <div
                      key={task.id}
                      draggable={canChangeStatus}
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", task.id);
                      }}
                    >
                      <TaskCard task={task} />
                    </div>
                  ))
                ) : (
                  <div className="flex min-h-24 items-center justify-center rounded-md border border-dashed border-border-default px-3 text-center text-xs text-ink-3">
                    No tasks in {statusLabels[status].toLowerCase()}.
                  </div>
                )}

                {hidden ? (
                  <Button
                    variant="custom"
                    type="button"
                    onClick={() => setShowAllDone(true)}
                    className="self-start rounded-sm px-2 py-1 text-left font-mono text-xs text-ink-3 outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {hidden} more
                  </Button>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};
