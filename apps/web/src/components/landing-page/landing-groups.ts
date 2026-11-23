import { moduleRegistry } from "@kyren/modules";

// name, monogram, line, live, desktop columns, desktop rows, mobile columns, preview, tint override
export type ModuleTile = [
  string,
  string,
  string,
  boolean,
  number,
  number,
  number,
  string?,
  string?,
];

function tile(id: string, code: string, cols: number, preview?: string): ModuleTile {
  const module = moduleRegistry.find((entry) => entry.id === id);
  if (!module) throw new Error(`Unknown workspace module: ${id}`);
  return [module.name, code, module.description, true, cols, 1, 2, preview];
}

export const GROUPS: Array<[string, string, ModuleTile[]]> = [
  ["Work", "var(--sky)", [tile("projects", "Pr", 6, "proj"), tile("tasks", "Ta", 6), tile("dashboard", "Db", 12)]],
  ["Knowledge", "var(--lav)", [tile("docs", "Dc", 6, "docs"), tile("files", "Fl", 6), tile("whiteboards", "Wb", 12)]],
  ["Talk", "var(--peach)", [tile("chat", "Ch", 6), tile("mail", "Ms", 6), tile("calendar", "Ca", 6), tile("tickets", "Tk", 6)]],
  ["Company", "var(--mint)", [tile("settings", "St", 6), tile("admin", "Ad", 6), tile("hr", "HR", 6), tile("payroll", "Py", 6)]],
];
