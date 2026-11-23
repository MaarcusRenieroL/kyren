import { Button } from "@kyren/ui/shadcn/button";
import { Grid2X2Icon, ListIcon, FolderKanbanIcon } from "lucide-react";
import { cn } from "@kyren/ui/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@kyren/ui/shadcn/select";
import type { Sort, ViewMode } from "./dashboard-filters";

export function DashboardCollectionHeader({
  project,
  categoryFilter,
  totalCount,
  sort,
  setSort,
  view,
  setView,
}: {
  project: string | null;
  categoryFilter: string;
  totalCount: number;
  sort: Sort;
  setSort: (s: Sort) => void;
  view: ViewMode;
  setView: (v: ViewMode) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline/80 pb-4">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-ink">
          {project === null
            ? categoryFilter === "specs"
              ? "Product Specs & RFCs"
              : categoryFilter === "meetings"
                ? "Meeting Notes"
                : categoryFilter === "recent"
                  ? "Recently Updated Docs"
                  : "All Documents"
            : project || "No Project"}
        </h2>
        <span className="font-mono text-xs text-ink-3">({totalCount})</span>
      </div>

      <div className="flex items-center gap-2">
        {/* Sort Select */}
        <Select value={sort} onValueChange={(value) => setSort(value as Sort)}>
          <SelectTrigger
            aria-label="Sort docs"
            className="h-8 gap-1.5 rounded-lg border-hairline bg-surface/80 px-2.5 text-xs shadow-none data-[size=default]:h-8"
          >
            <span className="text-ink-3">Sort:</span>
            <SelectValue>
              <span className="font-medium text-ink">
                {sort === "title"
                  ? "Title (A-Z)"
                  : sort === "project"
                    ? "Project"
                    : "Last edited"}
              </span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="edited">Last edited</SelectItem>
            <SelectItem value="title">Title (A-Z)</SelectItem>
            <SelectItem value="project">Project</SelectItem>
          </SelectContent>
        </Select>

        {/* View Mode Toggle: Grid / Table / Grouped */}
        <div
          role="radiogroup"
          aria-label="View mode"
          className="flex gap-0.5 rounded-lg border border-hairline bg-surface p-0.5"
        >
          {(
            [
              ["grid", Grid2X2Icon, "Grid"],
              ["table", ListIcon, "Table"],
              ["grouped", FolderKanbanIcon, "Grouped"],
            ] as const
          ).map(([value, Icon, label]) => (
            <Button
              variant="custom"
              key={value}
              type="button"
              role="radio"
              aria-checked={view === value}
              aria-label={`${label} view`}
              onClick={() => setView(value)}
              className={cn(
                "flex h-[26px] items-center gap-1.5 rounded-md px-2.5 text-xs transition-colors outline-none",
                view === value
                  ? "bg-ink text-ink-inverse font-medium"
                  : "text-ink-3 hover:text-ink hover:bg-hover",
              )}
              title={`${label} view`}
            >
              <Icon className="size-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">{label}</span>
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
