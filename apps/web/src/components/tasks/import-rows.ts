import { parseCsv } from "@kyren/audit";

export const MAX_IMPORT_ROWS = 200;

export type ImportRow = {
  name: string;
  description?: string;
  status: "backlog" | "todo" | "in-progress" | "review" | "done";
  priority: "low" | "medium" | "high";
  dueAt?: string;
};

export type ParsedImport = {
  rows: ImportRow[];
  /** Cells that were not understood and fell back to a default. */
  warnings: string[];
  /** Why nothing can be imported, when that is so. */
  error: string | null;
};

const statusNames: Record<string, ImportRow["status"]> = {
  backlog: "backlog",
  todo: "todo",
  "to do": "todo",
  "in-progress": "in-progress",
  "in progress": "in-progress",
  doing: "in-progress",
  review: "review",
  done: "done",
  complete: "done",
  completed: "done",
};

const priorityNames: Record<string, ImportRow["priority"]> = {
  low: "low",
  medium: "medium",
  normal: "medium",
  high: "high",
  urgent: "high",
};

const columnNames: Record<string, string> = {
  name: "name",
  title: "name",
  task: "name",
  summary: "name",
  description: "description",
  details: "description",
  status: "status",
  state: "status",
  priority: "priority",
  due: "dueAt",
  "due date": "dueAt",
  duedate: "dueAt",
  dueat: "dueAt",
};

/** Turns CSV text into task rows, with the first line as the header. */
export function parseTaskCsv(text: string): ParsedImport {
  const table = parseCsv(text);
  const header = table[0]?.map(
    (cell) => columnNames[cell.trim().toLowerCase()] ?? "",
  );

  if (!header || !header.includes("name")) {
    return {
      rows: [],
      warnings: [],
      error: 'The first row needs a "Name" column.',
    };
  }

  const body = table.slice(1);

  if (!body.length) {
    return { rows: [], warnings: [], error: "The file has no tasks." };
  }

  if (body.length > MAX_IMPORT_ROWS) {
    return {
      rows: [],
      warnings: [],
      error: `Import up to ${MAX_IMPORT_ROWS} tasks at a time. This file has ${body.length}.`,
    };
  }

  const rows: ImportRow[] = [];
  const warnings: string[] = [];

  body.forEach((cells, index) => {
    const line = index + 2;
    const get = (column: string) =>
      (cells[header.indexOf(column)] ?? "").trim();
    const name = get("name");

    if (!name) {
      warnings.push(`Line ${line}: no name, skipped.`);
      return;
    }

    const rawStatus = get("status").toLowerCase();
    const rawPriority = get("priority").toLowerCase();
    const rawDue = get("dueAt");
    const due = /^\d{4}-\d{2}-\d{2}$/.test(rawDue) ? rawDue : undefined;

    if (rawStatus && !statusNames[rawStatus])
      warnings.push(`Line ${line}: status “${rawStatus}” became To do.`);
    if (rawPriority && !priorityNames[rawPriority])
      warnings.push(`Line ${line}: priority “${rawPriority}” became Medium.`);
    if (rawDue && !due)
      warnings.push(
        `Line ${line}: due date “${rawDue}” was ignored (use YYYY-MM-DD).`,
      );

    rows.push({
      name: name.slice(0, 120),
      description: get("description") || undefined,
      status: statusNames[rawStatus] ?? "todo",
      priority: priorityNames[rawPriority] ?? "medium",
      dueAt: due,
    });
  });

  return {
    rows,
    warnings,
    error: rows.length ? null : "No row had a task name.",
  };
}
