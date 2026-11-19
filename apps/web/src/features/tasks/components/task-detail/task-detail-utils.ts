import type { TaskPriority, TaskStatus } from "~/src/features/tasks/lib/types";

export const taskStatuses = [
  "backlog",
  "todo",
  "in-progress",
  "review",
  "done",
] as const;

export const taskPriorities = ["low", "medium", "high"] as const;
export const unassignedValue = "__unassigned__";

export function toTaskStatus(value: string): TaskStatus {
  return taskStatuses.includes(value as TaskStatus)
    ? (value as TaskStatus)
    : "todo";
}

export function toTaskPriority(value: string): TaskPriority {
  return taskPriorities.includes(value as TaskPriority)
    ? (value as TaskPriority)
    : "medium";
}

/** The viewer's own calendar day of a due date, for a date input. */
export function getDateInputValue(value: Date | null) {
  if (!value) {
    return "";
  }

  const pad = (n: number) => String(n).padStart(2, "0");

  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

/**
 * A day picked in a date input (YYYY-MM-DD) as a due date: the end of that
 * day in the viewer's own time. Read as midnight UTC instead, a task due the
 * 19th showed as the 18th west of UTC and turned overdue as the 19th began.
 */
export function dueFromDateInput(value: string): Date | null {
  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) return null;

  return new Date(year, month - 1, day, 23, 59, 59, 999);
}

export function formatDate(value: Date | null) {
  if (!value) {
    return "None";
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(value);
}

export function getInitials(value: string | null | undefined) {
  if (!value) {
    return "UN";
  }

  return value
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
