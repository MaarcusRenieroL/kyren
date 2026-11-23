"use client";

import { cn } from "@kyren/ui/lib/utils";
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
} from "@kyren/ui/shadcn/alert-dialog";
import type { WorkspaceTask } from "~/src/features/tasks/lib/types";

type Props = {
  selected: WorkspaceTask[];
  actionClass: string;
  onDelete: (tasks: WorkspaceTask[]) => void;
  onClear: () => void;
};

export function BulkDeleteDialog({
  selected,
  actionClass,
  onDelete,
  onClear,
}: Props) {
  const count = selected.length;

  return (
    <AlertDialog>
      <AlertDialogTrigger className={cn(actionClass, "text-danger-on-ink")}>
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
