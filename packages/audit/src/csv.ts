/**
 * One CSV cell. Quotes values that need it, and defuses spreadsheet formulas
 * (cells that start with `=`, `+`, `-` or `@`) with a leading apostrophe.
 */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  let text =
    value instanceof Date
      ? value.toISOString()
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);

  if (/^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`;
  }

  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function buildCsv(header: string[], rows: unknown[][]): string {
  return [header, ...rows]
    .map((row) => row.map((cell) => csvCell(cell)).join(","))
    .join("\r\n");
}

/**
 * Reads CSV text into rows of cells. Handles quoted cells (commas, doubled
 * quotes and line breaks inside), CRLF or LF endings and a leading byte order
 * mark. Rows with no content are skipped.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const source = text.replace(/^﻿/, "");

  const endRow = () => {
    row.push(cell);
    cell = "";
    if (row.some((value) => value !== "")) rows.push(row);
    row = [];
  };

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i]!;

    if (quoted) {
      if (char === '"' && source[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[i + 1] === "\n") i += 1;
      endRow();
    } else {
      cell += char;
    }
  }

  if (cell !== "" || row.length) endRow();

  return rows;
}
