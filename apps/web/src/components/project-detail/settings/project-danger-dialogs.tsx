"use client";

import { Label } from "@kyren/ui/shadcn/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@kyren/ui/components/shadcn/alert-dialog";
import { Input } from "@kyren/ui/components/shadcn/input";

type ArchiveDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectName: string;
  isArchived: boolean;
  isArchiving: boolean;
  onToggle: () => void;
};

export function ArchiveProjectDialog({
  open,
  onOpenChange,
  projectName,
  isArchived,
  isArchiving,
  onToggle,
}: ArchiveDialogProps) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (isArchiving) return;
        onOpenChange(next);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isArchived ? `Restore ${projectName}?` : `Archive ${projectName}?`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isArchived
              ? `${projectName} will be active again.`
              : `${projectName} moves out of active work. Nothing is deleted.`}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isArchiving}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onToggle} disabled={isArchiving}>
            {isArchiving
              ? isArchived
                ? "Restoring..."
                : "Archiving..."
              : isArchived
                ? "Restore project"
                : "Archive project"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

type DeleteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectName: string;
  counts: { tasks: number; open: number; docs: number } | null;
  typedConfirmation: string;
  onTypedChange: (val: string) => void;
  isDeleting: boolean;
  onDelete: () => void;
};

export function DeleteProjectDialog({
  open,
  onOpenChange,
  projectName,
  counts,
  typedConfirmation,
  onTypedChange,
  isDeleting,
  onDelete,
}: DeleteDialogProps) {
  const isDeleteConfirmed = typedConfirmation === projectName;

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (isDeleting) return;
        onOpenChange(next);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {projectName}?</AlertDialogTitle>
          <AlertDialogDescription>
            This deletes the project for everyone. It can’t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {counts ? (
          <ul className="flex flex-col gap-1.5 rounded-md border border-hairline px-4 py-3 text-sm">
            <li className="flex gap-3">
              <span className="w-8 text-right font-mono">{counts.tasks}</span>
              tasks, including {counts.open} open
            </li>
            <li className="flex gap-3">
              <span className="w-8 text-right font-mono">{counts.docs}</span>
              docs and their comments
            </li>
          </ul>
        ) : null}

        <Label className="flex flex-col items-stretch gap-1.5 text-[13px]">
          <span>
            Type{" "}
            <span className="font-mono font-semibold text-ink">
              {projectName}
            </span>{" "}
            to confirm
          </span>
          <Input
            value={typedConfirmation}
            onChange={(event) => onTypedChange(event.target.value)}
            aria-label={`Type ${projectName} to confirm`}
            autoComplete="off"
            className="h-11 rounded-md border-hairline text-[15px]"
            disabled={isDeleting}
          />
        </Label>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={!isDeleteConfirmed || isDeleting}
            onClick={onDelete}
          >
            {isDeleting ? "Deleting..." : "Delete project"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
