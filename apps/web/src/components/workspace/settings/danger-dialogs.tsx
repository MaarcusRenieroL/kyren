"use client";

import { Label } from "@kyren/ui/shadcn/label";
import { cn } from "@kyren/ui/lib/utils";
import { Button } from "@kyren/ui/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@kyren/ui/shadcn/dialog";
import { Input } from "@kyren/ui/shadcn/input";

type DeleteDialogProps = {
  open: boolean;
  onClose: () => void;
  organizationName: string;
  stats: readonly (readonly [number, string])[];
  typed: string;
  onTypedChange: (val: string) => void;
  working: boolean;
  onDelete: () => void;
};

export function DeleteOrgDialog({
  open,
  onClose,
  organizationName,
  stats,
  typed,
  onTypedChange,
  working,
  onDelete,
}: DeleteDialogProps) {
  const matches = typed === organizationName;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-[520px] rounded-[20px]">
        <DialogHeader>
          <DialogTitle>Delete {organizationName}?</DialogTitle>
          <DialogDescription>
            Everyone loses access right away. We keep a backup for 7 days, so
            you can ask support to restore it until then.
          </DialogDescription>
        </DialogHeader>

        <dl className="grid grid-cols-4 divide-x divide-hairline rounded-xl border border-hairline">
          {stats.map(([value, label]) => (
            <div
              key={label}
              className="flex flex-col items-center gap-0.5 py-3"
            >
              <dt className="sr-only">{label}</dt>
              <dd className="font-mono text-lg">{value}</dd>
              <span aria-hidden="true" className="text-xs text-ink-3">
                {label}
              </span>
            </div>
          ))}
        </dl>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="delete-confirm" className="text-sm">
            Type{" "}
            <span className="rounded-xs bg-sunken px-1.5 py-0.5 font-mono text-xs">
              {organizationName}
            </span>{" "}
            to confirm.
          </Label>
          <Input
            id="delete-confirm"
            value={typed}
            autoComplete="off"
            onChange={(event) => onTypedChange(event.target.value)}
            placeholder={organizationName}
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={working}
            disabled={!matches}
            onClick={onDelete}
            className={cn(
              matches
                ? "bg-danger text-on-danger hover:bg-danger/90"
                : "border border-line-strong bg-transparent text-ink-3",
            )}
          >
            Delete organization
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type LeaveDialogProps = {
  open: boolean;
  onClose: () => void;
  organizationName: string;
  totalMembers: number;
  typed: string;
  onTypedChange: (val: string) => void;
  working: boolean;
  onLeave: () => void;
};

export function LeaveOrgDialog({
  open,
  onClose,
  organizationName,
  totalMembers,
  typed,
  onTypedChange,
  working,
  onLeave,
}: LeaveDialogProps) {
  const matches = typed === organizationName;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-[520px] rounded-[20px]">
        <DialogHeader>
          <DialogTitle>Leave {organizationName}?</DialogTitle>
          <DialogDescription>
            You’ll be removed from this workspace. The other{" "}
            {Math.max(totalMembers - 1, 0)} people keep access.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="leave-confirm" className="text-sm">
            Type{" "}
            <span className="rounded-xs bg-sunken px-1.5 py-0.5 font-mono text-xs">
              {organizationName}
            </span>{" "}
            to confirm.
          </Label>
          <Input
            id="leave-confirm"
            value={typed}
            autoComplete="off"
            onChange={(event) => onTypedChange(event.target.value)}
            placeholder={organizationName}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={working}
            disabled={!matches}
            onClick={onLeave}
            className={cn(
              matches
                ? "bg-danger text-on-danger hover:bg-danger/90"
                : "border border-line-strong bg-transparent text-ink-3",
            )}
          >
            Leave organization
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
