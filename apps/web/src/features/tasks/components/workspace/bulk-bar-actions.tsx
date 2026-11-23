"use client";

import { Label } from "@zentro/ui/shadcn/label";
import { Input } from "@zentro/ui/shadcn/input";
import { Button } from "@zentro/ui/shadcn/button";
import { useState } from "react";
import { cn } from "@zentro/ui/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@zentro/ui/shadcn/alert-dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@zentro/ui/shadcn/popover";

import type { BulkChange, WorkspaceTask } from "~/src/features/tasks/lib/types";
import { dueFromDateInput } from "../task-detail/task-detail-utils";

function toISODate(value: string) {
  return dueFromDateInput(value)?.toISOString() ?? null;
}

export function BulkDueDatePopover({
  count,
  selected,
  actionClassName,
  onChange,
}: {
  count: number;
  selected: WorkspaceTask[];
  actionClassName: string;
  onChange?: (tasks: WorkspaceTask[], change: BulkChange) => void;
}) {
  const [date, setDate] = useState("");
  const [dateOpen, setDateOpen] = useState(false);

  return (
    <Popover open={dateOpen} onOpenChange={setDateOpen}>
      <PopoverTrigger className={actionClassName}>Due date</PopoverTrigger>
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

export function BulkDeleteDialog({
  count,
  selected,
  actionClassName,
  onDelete,
  onClear,
}: {
  count: number;
  selected: WorkspaceTask[];
  actionClassName: string;
  onDelete: (tasks: WorkspaceTask[]) => void;
  onClear: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger className={cn(actionClassName, "text-danger-on-ink")}>
        Delete
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Delete {count} {count === 1 ? "task" : "tasks"}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {selected
              .slice(0, 3)
              .map((task) => task.key)
              .join(", ")}
            {count > 3 ? ` and ${count - 3} more` : ""} will be removed for
            everyone. Tasks you are not allowed to delete stay where they are.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => {
              onDelete(selected);
              onClear();
            }}
          >
            Delete {count === 1 ? "task" : "tasks"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
