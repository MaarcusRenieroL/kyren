"use client";

import { Switch } from "@zentro/ui/shadcn/switch";
import { LockIcon } from "lucide-react";
import { cn } from "@zentro/ui/lib/utils";
import { Skeleton } from "@zentro/ui/shadcn/skeleton";
import { getModuleIcon } from "~/src/lib/module-icons";
import { moduleNote, moduleTint, type ModuleRow } from "./create-org-types";

type StepModulesProps = {
  modules: ModuleRow[] | null;
  want: Record<string, boolean>;
  onToggle: (row: ModuleRow, on: boolean) => void;
};

export function StepModules({ modules, want, onToggle }: StepModulesProps) {
  if (modules === null) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {[0, 1, 2].map((item) => (
          <Skeleton key={item} className="h-36 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        {modules.map((row) => {
          const on = want[row.id] ?? row.enabled;
          const locked = row.id === "projects" && Boolean(want.tasks);
          const Icon = getModuleIcon(row.icon);

          return (
            <div
              key={row.id}
              className={cn("tile overflow-hidden", locked && "border-dashed")}
            >
              <div
                className={cn(
                  "flex h-[52px] items-center gap-2.5 pr-4 pl-3",
                  moduleTint[row.id] ?? "bg-tint-tasks",
                )}
              >
                <span className="flex size-7 items-center justify-center rounded-md border border-hairline bg-tint-chip">
                  <Icon className="size-3.5" aria-hidden="true" />
                </span>
                <span className="text-[15px] font-semibold">{row.name}</span>
                <span className="flex-1" />
                {locked ? (
                  <LockIcon
                    className="size-3.5 text-ink-2"
                    aria-label="Locked on"
                  />
                ) : null}
                <Switch
                  checked={on}
                  aria-label={`${row.name} module`}
                  disabled={locked}
                  onCheckedChange={(checked) => onToggle(row, checked)}
                />
              </div>
              <div className="flex flex-col gap-1.5 px-4 pt-3 pb-3.5">
                <p className="text-sm leading-5 text-ink-2">
                  {row.description}
                </p>
                <p className="font-mono text-xs text-ink-3">
                  {moduleNote[row.id] ?? "Works alone"}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[13px] text-ink-3">
        Files, Chat, Meetings and more are on the way. You can turn modules on
        or off any time in Settings.
      </p>
    </>
  );
}
