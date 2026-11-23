"use client";

import { Label } from "@zentro/ui/shadcn/label";
import { Input } from "@zentro/ui/shadcn/input";
import { Button } from "@zentro/ui/shadcn/button";
import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@zentro/ui/shadcn/popover";
import { dueFromDateInput } from "../task-detail/task-detail-utils";
import type { BulkChange, WorkspaceTask } from "~/src/features/tasks/lib/types";

function toISODate(value: string) {
  return dueFromDateInput(value)?.toISOString() ?? null;
}

type Props = {
  selected: WorkspaceTask[];
  actionClass: string;
  onChange?: (tasks: WorkspaceTask[], change: BulkChange) => void;
};

export function BulkDatePopover({ selected, actionClass, onChange }: Props) {
  const [date, setDate] = useState("");
  const [dateOpen, setDateOpen] = useState(false);
  const count = selected.length;

  return (
    <Popover open={dateOpen} onOpenChange={setDateOpen}>
      <PopoverTrigger className={actionClass}>Due date</PopoverTrigger>
      <PopoverContent
        side="top"
        sideOffset={10}
        className="w-64 gap-3 rounded-2xl p-3"
      >
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!date) return;
            onChange?.(selected, { dueAt: toISODate(date) });
            setDateOpen(false);
          }}
        >
          <Label className="flex flex-col items-stretch gap-1.5 text-[13px] font-medium">
            Due date for {count} {count === 1 ? "task" : "tasks"}
            <Input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="h-10 rounded-md border border-hairline bg-surface px-3 font-mono text-sm outline-none focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/22"
            />
          </Label>
          <div className="flex justify-between gap-2">
            <Button
              variant="custom"
              type="button"
              onClick={() => {
                onChange?.(selected, { dueAt: null });
                setDateOpen(false);
              }}
              className="h-8 rounded-md px-2 text-[13px] text-ink-2 outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-ring"
            >
              Clear date
            </Button>
            <Button
              variant="custom"
              type="submit"
              className="h-8 rounded-md bg-signal px-3 text-[13px] font-semibold text-on-signal outline-none hover:bg-signal-hover focus-visible:ring-2 focus-visible:ring-ring"
            >
              Set date
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
