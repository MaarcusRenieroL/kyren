import type { ReactNode } from "react";
import { Trash2Icon } from "lucide-react";

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
} from "@kyren/ui/components/shadcn/alert-dialog";
import { PriorityMeter, StatusGlyph } from "@kyren/ui/components/status-glyph";
import { Button } from "@kyren/ui/shadcn/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@kyren/ui/shadcn/select";

import type { TaskPriority, TaskStatus } from "~/src/features/tasks/lib/types";

import { AvatarInitials } from "./avatar-initials";
import { DetailRow } from "./detail-row";
import {
  formatDate,
  toTaskPriority,
  toTaskStatus,
} from "./task-detail-utils";
import type { MemberOption, TaskDetail, TaskUpdate } from "./types";
import { AssigneePicker } from "./sidebar/assignee-picker";
import { DuePicker } from "./sidebar/due-picker";

type Props = {
  task: TaskDetail;
  members: MemberOption[];
  savingField: string | null;
  onSave: (field: string, values: TaskUpdate) => void;
  onDelete: () => void;
  canEdit: boolean;
  canAssign: boolean;
  canDelete: boolean;
  /** The Thread tile, shown under Details. */
  thread?: ReactNode;
};

export function TaskDetailSidebar({
  task,
  members,
  savingField,
  onSave,
  onDelete,
  canEdit,
  canAssign,
  canDelete,
  thread,
}: Props) {
  return (
    <aside className="flex flex-col gap-4">
      <Select
        value={toTaskStatus(task.status)}
        onValueChange={(status: TaskStatus) => onSave("status", { status })}
        disabled={savingField === "status" || !canEdit}
      >
        <SelectTrigger
          aria-label="Status"
          className="h-11 w-full justify-start gap-2.5 rounded-md border-hairline bg-surface px-3 text-[15px] font-medium shadow-none data-[size=default]:h-11 [&>svg:last-child]:ml-auto"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(
            [
              ["backlog", "Backlog"],
              ["todo", "To do"],
              ["in-progress", "In progress"],
              ["review", "Review"],
              ["done", "Done"],
            ] as const
          ).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              <StatusGlyph status={value} size={12} decorative />
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <section aria-label="Details" className="tile px-4 py-2">
        <DetailRow label="Assignee">
          <AssigneePicker
            members={members}
            value={task.assignedToMemberId}
            disabled={savingField === "assignee" || !canAssign}
            onChange={(assignedToMemberId) =>
              onSave("assignee", { assignedToMemberId })
            }
          />
        </DetailRow>

        <DetailRow label="Priority">
          <Select
            value={toTaskPriority(task.priority)}
            onValueChange={(priority: TaskPriority) =>
              onSave("priority", { priority })
            }
            disabled={savingField === "priority" || !canEdit}
          >
            <SelectTrigger
              aria-label="Priority"
              className="h-8 border-0 bg-transparent px-1.5 -ml-1.5 shadow-none hover:bg-hover"
            >
              <PriorityMeter priority={task.priority} />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
        </DetailRow>

        <DetailRow label="Due date">
          <DuePicker
            value={task.due}
            done={task.status === "done"}
            disabled={savingField === "dueAt" || !canEdit}
            onChange={(dueAt) => onSave("dueAt", { dueAt })}
          />
        </DetailRow>

        <DetailRow label="Team">
          <span className="flex items-center gap-2.5">
            {task.teamName ? (
              <span
                aria-hidden="true"
                className="size-2.5 rounded-[3px] border border-hairline bg-tint-teams"
              />
            ) : null}
            <span className={task.teamName ? undefined : "text-ink-3"}>
              {task.teamName ?? "No team"}
            </span>
          </span>
        </DetailRow>

        {task.reporter ? (
          <DetailRow label="Reporter">
            <span className="inline-flex items-center gap-2.5">
              <AvatarInitials value={task.reporter} />
              {task.reporter}
            </span>
          </DetailRow>
        ) : null}
      </section>

      {thread}

      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <p className="font-mono text-[11px] text-ink-3">
          Created {formatDate(task.createdAt)} · updated{" "}
          {formatDate(task.updatedAt)}
        </p>
        {canDelete ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-danger-text hover:bg-danger-subtle hover:text-danger-text"
                disabled={savingField === "delete"}
              >
                <Trash2Icon className="size-3.5" />
                Delete task
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {task.key}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This task will be removed from task lists and boards. Its
                  activity history is kept for audit trails.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={onDelete}
                >
                  Delete task
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
      </div>
    </aside>
  );
}
