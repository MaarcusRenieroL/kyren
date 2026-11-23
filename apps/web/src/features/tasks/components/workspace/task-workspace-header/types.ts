import type { ReactNode } from "react";
import type { TaskPriority, TaskStatus } from "~/src/features/tasks/lib/types";

export const allValue = "__all__";

export type TaskGroup = "state" | "priority" | "project" | "assignee" | "none";
export type TaskSort = "due" | "priority" | "key" | "title";
export type TaskView = "list" | "board" | "calendar";
export type SavedView = "all" | "mine" | "week";

export const savedViewLabels: Record<SavedView, string> = {
  all: "All tasks",
  mine: "My open tasks",
  week: "Due this week",
};

export const groupLabels: Record<TaskGroup, string> = {
  state: "State",
  priority: "Priority",
  project: "Project",
  assignee: "Assignee",
  none: "None",
};

export const sortLabels: Record<TaskSort, string> = {
  due: "Due date",
  priority: "Priority",
  key: "Newest",
  title: "Title",
};

export const statusNames: Record<string, string> = {
  backlog: "Backlog",
  todo: "To do",
  "in-progress": "In progress",
  review: "Review",
  done: "Done",
};

export type TaskWorkspaceHeaderProps = {
  title: string;
  taskCount: number;
  totalCount: number;
  projectScoped?: boolean;
  assigneeOptions: string[];
  teamOptions: Array<{ id: string; name: string }>;
  filtersActive: boolean;
  searchQuery: string;
  statusFilter: TaskStatus | "all";
  priorityFilter: TaskPriority | "all";
  assigneeFilter: string;
  teamFilter: string;
  group: TaskGroup;
  sort: TaskSort;
  view: TaskView;
  viewControl: ReactNode;
  savedView: SavedView;
  onSavedViewChange: (value: SavedView) => void;
  /** Phones: no grouping, sorting or view switch, and the filters scroll. */
  compact?: boolean;
  onSearchQueryChange: (value: string) => void;
  onStatusFilterChange: (value: TaskStatus | "all") => void;
  onPriorityFilterChange: (value: TaskPriority | "all") => void;
  onAssigneeFilterChange: (value: string) => void;
  onTeamFilterChange: (value: string) => void;
  onGroupChange: (value: TaskGroup) => void;
  onSortChange: (value: TaskSort) => void;
  onClearFilters: () => void;
  onTaskCreated?: () => void | Promise<void>;
};
