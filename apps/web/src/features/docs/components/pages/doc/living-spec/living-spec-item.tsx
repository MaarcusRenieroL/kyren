"use client";

import { Button } from "@kyren/ui/shadcn/button";
import type { FC } from "react";
import Link from "next/link";
import { ExternalLinkIcon, Trash2Icon } from "lucide-react";
import { StatusGlyph, PriorityMeter } from "@kyren/ui/components/status-glyph";
import { cn } from "@kyren/ui/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@kyren/ui/shadcn/dropdown-menu";
import { ActorAvatar } from "~/src/components/actor-avatar";
import { statusOptions, type LivingSpecTask } from "./types";

type LivingSpecItemProps = {
  task: LivingSpecTask;
  canEdit: boolean;
  updatingTaskKey: string | null;
  onStatusChange: (taskKey: string, newStatus: string) => void;
  onUnlink: (linkId: string, taskKey: string | null) => void;
};

export const LivingSpecItem: FC<LivingSpecItemProps> = ({
  task,
  canEdit,
  updatingTaskKey,
  onStatusChange,
  onUnlink,
}) => {
  const isDone = task.status === "done";

  return (
    <div
      className={cn(
        "group relative p-3 rounded-xl border border-hairline/80 bg-surface/80 hover:bg-surface transition-all hover:border-signal/40 hover:shadow-xs shadow-2xs",
        isDone && "opacity-70 bg-muted/20",
      )}
    >
      <div className="flex items-start gap-2.5">
        {/* Status toggle button */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="custom"
              type="button"
              disabled={!canEdit || updatingTaskKey === task.key}
              className="mt-0.5 shrink-0 rounded hover:scale-110 transition-transform focus:outline-none"
              title="Change status"
            >
              <StatusGlyph status={task.status ?? "todo"} size={14} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-40 text-xs">
            {statusOptions.map((opt) => (
              <DropdownMenuItem
                key={opt.value}
                className="gap-2 text-xs"
                onClick={() => task.key && onStatusChange(task.key, opt.value)}
              >
                <StatusGlyph status={opt.value} size={12} />
                {opt.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Task details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            {task.key && (
              <Link
                href={`/tasks/${task.key}`}
                className="font-mono text-[11px] font-semibold text-signal hover:underline shrink-0"
                target="_blank"
              >
                {task.key}
              </Link>
            )}
            {task.estimatePoints !== null &&
              task.estimatePoints !== undefined && (
                <span className="font-mono text-[10px] px-1 py-0.2 rounded bg-muted/60 text-ink-3">
                  {task.estimatePoints} pts
                </span>
              )}
            <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {task.key && (
                <Link
                  href={`/tasks/${task.key}`}
                  target="_blank"
                  className="p-1 rounded text-ink-3 hover:text-ink"
                  title="Open task in new tab"
                >
                  <ExternalLinkIcon className="size-3" />
                </Link>
              )}
              {canEdit && (
                <Button
                  variant="custom"
                  type="button"
                  onClick={() => onUnlink(task.linkId, task.key)}
                  className="p-1 rounded text-ink-3 hover:text-danger-text"
                  title="Unlink from spec"
                >
                  <Trash2Icon className="size-3" />
                </Button>
              )}
            </div>
          </div>

          <p
            className={cn(
              "text-xs text-ink font-medium leading-snug line-clamp-2",
              isDone && "line-through text-ink-3",
            )}
          >
            {task.title}
          </p>

          <div className="flex items-center gap-2 mt-2 pt-1 border-t border-hairline/60 text-[11px] text-ink-3">
            <div className="flex items-center gap-1">
              <PriorityMeter priority={task.priority ?? "medium"} />
              <span className="capitalize">{task.priority ?? "medium"}</span>
            </div>
            {task.assignee && (
              <div className="flex items-center gap-1 ml-auto">
                <ActorAvatar name={task.assignee} size={14} />
                <span className="truncate max-w-[90px]">{task.assignee}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
