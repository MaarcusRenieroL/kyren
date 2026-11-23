import { parseCsv } from "@kyren/audit";

export const MAX_IMPORT_PEOPLE = 200;

export type PersonRow = {
  name: string;
  email: string | null;
  jobTitle: string;
  department: string | null;
  location: string | null;
  startDate: string | null;
};

export type ParsedPeople = {
  rows: PersonRow[];
  warnings: string[];
  error: string | null;
};

const columnNames: Record<string, keyof PersonRow> = {
  name: "name",
  "full name": "name",
  email: "email",
  "email address": "email",
  "job title": "jobTitle",
  title: "jobTitle",
  role: "jobTitle",
  department: "department",
  team: "department",
  location: "location",
  office: "location",
  "start date": "startDate",
  start: "startDate",
  joined: "startDate",
};

const looksLikeEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

/** Turns CSV text into people rows, with the first line as the header. */
export function parsePeopleCsv(text: string): ParsedPeople {
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
    return { rows: [], warnings: [], error: "The file has no people." };
  }

  if (body.length > MAX_IMPORT_PEOPLE) {
    return {
      rows: [],
      warnings: [],
      error: `Import up to ${MAX_IMPORT_PEOPLE} people at a time. This file has ${body.length}.`,
    };
  }

  const rows: PersonRow[] = [];
  const warnings: string[] = [];

  body.forEach((cells, index) => {
    const line = index + 2;
    const get = (column: string) =>
      (cells[header.indexOf(column as keyof PersonRow)] ?? "").trim();
    const name = get("name");

    if (!name) {
      warnings.push(`Line ${line}: no name, skipped.`);
      return;
    }

    const email = get("email");
    const start = get("startDate");

    if (email && !looksLikeEmail(email))
      warnings.push(`Line ${line}: email “${email}” was ignored.`);
    if (start && !/^\d{4}-\d{2}-\d{2}$/.test(start))
      warnings.push(
        `Line ${line}: start date “${start}” was ignored (use YYYY-MM-DD).`,
      );

    rows.push({
      name: name.slice(0, 120),
      email: looksLikeEmail(email) ? email.slice(0, 200) : null,
      jobTitle: get("jobTitle").slice(0, 120),
      department: get("department").slice(0, 80) || null,
      location: get("location").slice(0, 80) || null,
      startDate: /^\d{4}-\d{2}-\d{2}$/.test(start) ? start : null,
    });
  });

  return {
    rows,
    warnings,
    error: rows.length ? null : "No row had a name.",
  };
}
