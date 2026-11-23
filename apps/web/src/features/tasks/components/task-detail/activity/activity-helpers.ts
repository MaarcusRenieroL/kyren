import { formatDate } from "../task-detail-utils";
import type { MemberOption, TaskActivityEvent } from "../types";

export function formatActivityDate(value: Date | null) {
  if (!value) {
    return "just now";
  }

  const date = new Date(value);
  const time = date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const day =
    date.toDateString() === new Date().toDateString()
      ? "Today"
      : date.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return `${day} · ${time}`;
}

export function getFieldLabel(field: string) {
  const labels: Record<string, string> = {
    assignedToMemberId: "assignee",
    dueAt: "due date",
    name: "title",
  };

  return labels[field] ?? field;
}

export function formatActivityValue(
  value: string | null,
  field: string,
  members: MemberOption[],
) {
  if (!value) {
    return "None";
  }

  if (field === "status") {
    const labels: Record<string, string> = {
      backlog: "Backlog",
      todo: "To do",
      "in-progress": "In progress",
      review: "Review",
      done: "Done",
    };

    return labels[value] ?? value;
  }

  if (field === "assignedToMemberId") {
    const member = members.find((candidate) => candidate.id === value);
    return member?.name ?? member?.email ?? value;
  }

  if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return formatDate(new Date(value));
  }

  return value;
}

export function getActivityLabel(event: TaskActivityEvent, members: MemberOption[]) {
  if (event.type === "task.created") {
    return "created this task";
  }

  if (event.type === "task.deleted") {
    return "deleted this task";
  }

  if (event.type === "comment.created") {
    return "commented";
  }

  if (event.type === "task.updated" && event.field) {
    if (event.field === "description") {
      return "updated description";
    }

    return `changed ${getFieldLabel(event.field)} from ${formatActivityValue(
      event.fromValue,
      event.field,
      members,
    )} to ${formatActivityValue(event.toValue, event.field, members)}`;
  }

  return "updated this task";
}
