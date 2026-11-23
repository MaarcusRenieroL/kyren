"use client";

import { Button } from "@kyren/ui/shadcn/button";
import { useEffect, useState, type FC, type ReactNode } from "react";
import { XIcon } from "lucide-react";

import { useTrpcClient } from "@kyren/api/react";
import { PriorityMeter, StatusGlyph } from "@kyren/ui/components/status-glyph";
import { cn } from "@kyren/ui/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@kyren/ui/shadcn/dropdown-menu";

import { ActorAvatar } from "~/src/components/actor-avatar";
import { useReachable } from "~/src/components/permissions/permission-provider";
import { statusLabels } from "~/src/features/tasks/lib/constants";
import type {
  BulkChange,
  TaskPriority,
  TaskStatus,
  WorkspaceTask,
} from "~/src/features/tasks/lib/types";
import { BulkDeleteDialog, BulkDueDatePopover } from "./bulk-bar-actions";

const statuses: TaskStatus[] = [
  "todo",
  "in-progress",
  "review",
  "done",
  "backlog",
];

type Member = { id: string; userId: string; name: string };

type Props = {
  selected: WorkspaceTask[];
  onChange?: (tasks: WorkspaceTask[], change: BulkChange) => void;
  onDelete?: (tasks: WorkspaceTask[]) => void;
  onClear: () => void;
};

const action =
  "h-[34px] rounded-[10px] px-3 text-[13px] text-ink-inverse outline-none hover:bg-ink-inverse/10 focus-visible:ring-2 focus-visible:ring-ink-inverse/60 aria-expanded:bg-ink-inverse/10";

/** What you can do to the selected tasks: one dark bar under the list. */
export const BulkBar: FC<Props> = ({
  selected,
  onChange,
  onDelete,
  onClear,
}) => {
  const trpc = useTrpcClient();
  const canAssign = useReachable("tasks.assign");
  const canDeleteOwn = useReachable("tasks.delete_own");
  const canDeleteAny = useReachable("tasks.delete_any");
  const canDelete = canDeleteOwn || canDeleteAny;
  const [members, setMembers] = useState<Member[] | null>(null);
  const count = selected.length;

  useEffect(() => {
    if (!canAssign) return;

    let live = true;

    trpc.member.getMembers
      .query()
      .then((rows) => {
        if (live) {
          setMembers(
            rows.map((row) => ({
              id: row.id,
              userId: row.userId,
              name: row.name,
            })),
          );
        }
      })
      .catch(() => live && setMembers([]));

    return () => {
      live = false;
    };
  }, [canAssign, trpc]);

  const menu = (label: string, children: ReactNode) => (
    <DropdownMenu>
      <DropdownMenuTrigger className={action}>{label}</DropdownMenuTrigger>
      <DropdownMenuContent
        side="top"
        align="start"
        sideOffset={10}
        className="max-h-80 w-56 rounded-2xl p-1.5"
      >
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div
      role="toolbar"
      aria-label="Bulk actions"
      className="sticky bottom-7 z-(--z-sticky) mx-auto mt-4 flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-2xl bg-ink py-1.5 pr-1.5 pl-4 text-ink-inverse shadow-xl motion-safe:animate-fade-up"
    >
      <span className="mr-2.5 font-mono text-[13px] whitespace-nowrap">
        {count} selected
      </span>
      <span
        aria-hidden="true"
        className="mr-1 h-5 w-px shrink-0 bg-ink-inverse/25"
      />

      {menu(
        "Status",
        statuses.map((status) => (
          <DropdownMenuItem
            key={status}
            onSelect={() => onChange?.(selected, { status })}
          >
            <StatusGlyph status={status} size={12} decorative />
            {statusLabels[status]}
          </DropdownMenuItem>
        )),
      )}

      {menu(
        "Priority",
        (["high", "medium", "low"] as TaskPriority[]).map((priority) => (
          <DropdownMenuItem
            key={priority}
            onSelect={() => onChange?.(selected, { priority })}
          >
            <PriorityMeter priority={priority} />
            <span className="capitalize">{priority}</span>
          </DropdownMenuItem>
        )),
      )}

      {menu(
        "Estimate",
        [1, 2, 3, 5, 8, null].map((pts) => (
          <DropdownMenuItem
            key={pts ?? "clear"}
            onSelect={() => onChange?.(selected, { estimatePoints: pts })}
          >
            {pts !== null ? `${pts} pts` : "Clear estimate"}
          </DropdownMenuItem>
        )),
      )}

      {canAssign
        ? menu(
            "Assign",
            <>
              {(members ?? []).map((member) => (
                <DropdownMenuItem
                  key={member.id}
                  onSelect={() =>
                    onChange?.(selected, {
                      assignedToMemberId: member.id,
                      assignee: member.name,
                      assigneeUserId: member.userId,
                    })
                  }
                >
                  <ActorAvatar name={member.name} size={20} />
                  <span className="truncate">{member.name}</span>
                </DropdownMenuItem>
              ))}
              {members?.length ? <DropdownMenuSeparator /> : null}
              <DropdownMenuItem
                onSelect={() =>
                  onChange?.(selected, {
                    assignedToMemberId: null,
                    assignee: "Unassigned",
                    assigneeUserId: null,
                  })
                }
              >
                <span
                  aria-hidden="true"
                  className="size-5 rounded-full border-[1.5px] border-dashed border-line-strong"
                />
                Unassigned
              </DropdownMenuItem>
            </>,
          )
        : null}

      <BulkDueDatePopover
        count={count}
        selected={selected}
        actionClassName={action}
        onChange={onChange}
      />

      {canDelete && onDelete ? (
        <BulkDeleteDialog
          count={count}
          selected={selected}
          actionClassName={action}
          onDelete={onDelete}
          onClear={onClear}
        />
      ) : null}

      <Button
        variant="custom"
        type="button"
        onClick={onClear}
        aria-label="Clear selection"
        className={cn(action, "flex w-[34px] items-center justify-center px-0")}
      >
        <XIcon className="size-3.5" aria-hidden="true" />
      </Button>
    </div>
  );
};
