"use client";

import { Button } from "@kyren/ui/shadcn/button";
import Link from "next/link";
import { CalendarDaysIcon, Columns3Icon, ListIcon } from "lucide-react";
import { cn } from "@kyren/ui/lib/utils";
import type { TaskView } from "../task-workspace-header";
import {
  SavedViewsMenu,
  type ViewConfig,
  type NewViewConfig,
} from "../saved-views-menu";

export const views = [
  { value: "list", label: "List", Icon: ListIcon },
  { value: "board", label: "Board", Icon: Columns3Icon },
  { value: "calendar", label: "Calendar", Icon: CalendarDaysIcon },
] as const;

export function WorkspaceViewControls({
  currentConfig,
  applyConfig,
  view,
  setView,
}: {
  currentConfig: NewViewConfig;
  applyConfig: (config: ViewConfig) => void;
  view: TaskView;
  setView: (view: TaskView) => void;
}) {
  return (
    <>
      <SavedViewsMenu current={currentConfig} onApply={applyConfig} />
      <Link
        href="/tasks/timesheet"
        className="rounded-xl border border-hairline bg-surface px-3 py-1.5 text-sm text-ink-2 hover:text-ink"
      >
        Timesheet
      </Link>
      <Link
        href="/tasks/goals"
        className="rounded-xl border border-hairline bg-surface px-3 py-1.5 text-sm text-ink-2 hover:text-ink"
      >
        Goals
      </Link>
      <Link
        href="/tasks/trash"
        className="rounded-xl border border-hairline bg-surface px-3 py-1.5 text-sm text-ink-2 hover:text-ink"
      >
        Trash
      </Link>
      <div
        role="radiogroup"
        aria-label="View"
        className="flex gap-0.5 rounded-xl border border-hairline bg-surface p-[3px]"
      >
        {views.map(({ value, label, Icon }) => (
          <Button
            variant="custom"
            key={value}
            type="button"
            role="radio"
            aria-checked={view === value}
            onClick={() => setView(value)}
            className={cn(
              "flex h-[26px] items-center gap-1.5 rounded-[9px] px-2.5 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring",
              view === value
                ? "bg-ink text-ink-inverse"
                : "text-ink-2 hover:text-ink",
            )}
          >
            <Icon className="size-3.5" aria-hidden="true" />
            {label}
          </Button>
        ))}
      </div>
    </>
  );
}
