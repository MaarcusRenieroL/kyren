import { formatDueDate } from "@kyren/utils";

export type Related = {
  kind: "task" | "doc";
  id: string;
  label: string;
  status?: string;
  sub: string;
  late?: boolean;
  href: string;
};

export const shortDate = (value: Date | string) =>
  new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

export function firstName(name: string | null | undefined) {
  return name ? (name.split(" ")[0] ?? name) : "Unassigned";
}

/** A task's owner and where its date stands, as one short line. */
export function taskSub(task: {
  assignee: string | null;
  due: Date | null;
  status: string;
}) {
  const owner = firstName(task.assignee);

  if (task.status === "done") return { sub: `${owner} · done`, late: false };
  if (!task.due) return { sub: `${owner} · no date`, late: false };

  const due = formatDueDate(task.due);

  return due.tone === "overdue"
    ? { sub: `${owner} · overdue ${shortDate(task.due)}`, late: true }
    : { sub: `${owner} · due ${due.text}`, late: false };
}
