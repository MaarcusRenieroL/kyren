import { buildCsv } from "@zentro/audit";

type Line = {
  employeeName: string;
  currency: string;
  base: number;
  bonus: number;
  deductions: number;
  net: number;
};

const major = (minor: number) => (minor / 100).toFixed(2);

/** A pay run as a CSV an accountant or bank can open: amounts in major units. */
export function runCsv(lines: Line[]) {
  return buildCsv(
    ["Employee", "Currency", "Base", "Bonus", "Deductions", "Net"],
    lines.map((line) => [
      line.employeeName,
      line.currency,
      major(line.base),
      major(line.bonus),
      major(line.deductions),
      major(line.net),
    ]),
  );
}

export function csvFileName(label: string) {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `pay-run-${slug || "export"}.csv`;
}
