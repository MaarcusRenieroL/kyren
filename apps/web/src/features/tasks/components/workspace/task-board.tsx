"use client";

import { useState, type DragEvent, type FC } from "react";
import type { TaskStatus } from "~/src/features/tasks/lib/types";
import { EmptyTasks } from "./empty-tasks";
import { columns, type TaskBoardProps } from "./task-board/types";
import { useSwimlanes } from "./task-board/use-swimlanes";
import { SwimlanesView } from "./task-board/swimlanes-view";
import { ColumnView } from "./task-board/column-view";

export const TaskBoard: FC<TaskBoardProps> = ({
  tasks,
  group = "state",
  onTaskStatusChange,
  onTaskCreated,
  empty,
}) => {
  const [showAllDone, setShowAllDone] = useState(false);
  const [collapsedLanes, setCollapsedLanes] = useState<Record<string, boolean>>(
    {},
  );

  const shown = columns.filter(
    (status) =>
      status !== "backlog" || tasks.some((task) => task.status === status),
  );

  function handleDrop(event: DragEvent<HTMLElement>, status: TaskStatus) {
    event.preventDefault();

    const taskId = event.dataTransfer.getData("text/plain");
    const task = tasks.find((candidate) => candidate.id === taskId);

    if (!task || task.status === status) {
      return;
    }

    onTaskStatusChange?.(task, status);
  }

  const toggleLane = (laneId: string) => {
    setCollapsedLanes((prev) => ({
      ...prev,
      [laneId]: !prev[laneId],
    }));
  };

  const isSwimlaneMode =
    group === "assignee" || group === "priority" || group === "project";

  const swimlanes = useSwimlanes(tasks, group, isSwimlaneMode);

  if (isSwimlaneMode) {
    return (
      <SwimlanesView
        shown={shown}
        tasks={tasks}
        swimlanes={swimlanes}
        collapsedLanes={collapsedLanes}
        onToggleLane={toggleLane}
        onDrop={handleDrop}
        canChangeStatus={Boolean(onTaskStatusChange)}
      />
    );
  }

  // Classic Board Columns
  // After every hook, so the hook order never changes between renders.
  if (!tasks.length) return empty ?? <EmptyTasks />;

  return (
    <ColumnView
      shown={shown}
      tasks={tasks}
      showAllDone={showAllDone}
      setShowAllDone={setShowAllDone}
      onDrop={handleDrop}
      onTaskCreated={onTaskCreated}
      canChangeStatus={Boolean(onTaskStatusChange)}
    />
  );
};
