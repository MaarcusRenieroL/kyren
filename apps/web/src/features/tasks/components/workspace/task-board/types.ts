import type { ReactNode } from "react";
import type { TaskStatus, WorkspaceTask } from "~/src/features/tasks/lib/types";
import type { TaskGroup } from "./../task-workspace-header";

export const columns: TaskStatus[] = [
  "in-progress",
  "review",
  "todo",
  "backlog",
  "done",
];

export const doneVisible = 3;

export type Swimlane = {
  id: string;
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  tasks: WorkspaceTask[];
  totalPoints: number;
};

export type TaskBoardProps = {
  tasks: WorkspaceTask[];
  group?: TaskGroup;
  onTaskStatusChange?: (task: WorkspaceTask, status: TaskStatus) => void;
  onTaskCreated?: () => void | Promise<void>;
  empty?: ReactNode;
};
