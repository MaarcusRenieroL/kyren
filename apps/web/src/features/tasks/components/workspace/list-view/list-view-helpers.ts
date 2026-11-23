import { statusLabels } from "~/src/features/tasks/lib/constants";
import type { TaskStatus, WorkspaceTask } from "~/src/features/tasks/lib/types";
import type { TaskGroup, TaskSort } from "./../task-workspace-header";

// What is moving comes first; finished and parked work folds away.
export const stateOrder: Array<{ status: TaskStatus; collapsed: boolean }> = [
  { status: "in-progress", collapsed: false },
  { status: "review", collapsed: false },
  { status: "todo", collapsed: false },
  { status: "backlog", collapsed: true },
  { status: "done", collapsed: true },
];

export const priorityRank = { high: 0, medium: 1, low: 2 } as const;

export function sortTasks(tasks: WorkspaceTask[], sort: TaskSort) {
  const copy = [...tasks];

  copy.sort((a, b) => {
    if (sort === "title") return a.title.localeCompare(b.title);
    if (sort === "priority") {
      return (
        priorityRank[a.priority] - priorityRank[b.priority] ||
        a.title.localeCompare(b.title)
      );
    }
    if (sort === "key") {
      return b.key.localeCompare(a.key, undefined, { numeric: true });
    }

    // Due date: soonest first, undated last.
    const left = a.dueAt ? new Date(a.dueAt).getTime() : Infinity;
    const right = b.dueAt ? new Date(b.dueAt).getTime() : Infinity;

    return left - right || a.title.localeCompare(b.title);
  });

  return copy;
}

export type Section = {
  id: string;
  label: string;
  status?: TaskStatus;
  collapsed: boolean;
  rows: WorkspaceTask[];
};

export function buildSections(tasks: WorkspaceTask[], group: TaskGroup): Section[] {
  if (group === "none") {
    return [{ id: "all", label: "All tasks", collapsed: false, rows: tasks }];
  }

  if (group === "state") {
    return stateOrder
      .map(({ status, collapsed }) => ({
        id: status,
        label: statusLabels[status],
        status,
        collapsed,
        rows: tasks.filter((task) => task.status === status),
      }))
      .filter((section) => section.rows.length);
  }

  const keyOf = (task: WorkspaceTask) =>
    group === "priority"
      ? task.priority
      : group === "project"
        ? task.projectName
        : task.assignee;
  const labelOf = (value: string) =>
    group === "priority"
      ? value.charAt(0).toUpperCase() + value.slice(1)
      : value;
  const buckets = new Map<string, WorkspaceTask[]>();

  for (const task of tasks) {
    const key = keyOf(task);

    buckets.set(key, [...(buckets.get(key) ?? []), task]);
  }

  return Array.from(buckets, ([key, rows]) => ({
    id: key,
    label: labelOf(key),
    collapsed: false,
    rows,
  })).sort((a, b) =>
    group === "priority"
      ? priorityRank[a.id as keyof typeof priorityRank] -
        priorityRank[b.id as keyof typeof priorityRank]
      : a.label.localeCompare(b.label),
  );
}
