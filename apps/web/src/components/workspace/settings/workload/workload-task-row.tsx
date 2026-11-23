"use client";

import type { FC } from "react";
import Link from "next/link";
import { ArrowRightLeftIcon } from "lucide-react";
import { StatusGlyph } from "@kyren/ui/components/status-glyph";
import { cn } from "@kyren/ui/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@kyren/ui/shadcn/dropdown-menu";
import { ActorAvatar } from "~/src/components/actor-avatar";
import { paths } from "~/src/lib/paths";
import type { LiveMemberLoad, WorkloadTask } from "./types";

type WorkloadTaskRowProps = {
  task: WorkloadTask;
  currentMemberId: string;
  reassigningKey: string | null;
  liveMemberLoads: LiveMemberLoad[];
  onReassign: (
    taskKey: string,
    targetMemberId: string,
    targetMemberName: string,
  ) => void;
};

export const WorkloadTaskRow: FC<WorkloadTaskRowProps> = ({
  task,
  currentMemberId,
  reassigningKey,
  liveMemberLoads,
  onReassign,
}) => {
  return (
    <div className="flex items-center gap-2.5 py-2 text-xs hover:bg-hover/40 px-1 rounded transition-colors">
      <StatusGlyph status={task.status} size={12} />
      <Link
        href={paths.task(task.key)}
        className="font-mono text-ink font-medium hover:underline shrink-0"
      >
        {task.key}
      </Link>
      <Link
        href={paths.task(task.key)}
        className="truncate text-ink-2 hover:text-ink flex-1"
      >
        {task.name}
      </Link>

      {task.estimatePoints ? (
        <span className="font-mono text-[10px] rounded bg-surface px-1.5 py-0.5 border border-hairline shrink-0">
          {task.estimatePoints}pt
        </span>
      ) : null}

      <span className="hidden md:inline font-mono text-[10px] text-ink-3 shrink-0">
        {task.projectName}
      </span>

      {/* Reassign Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={reassigningKey === task.key}
          className="inline-flex items-center gap-1 rounded-md border border-hairline bg-surface px-2 py-1 text-[11px] font-medium text-ink-2 hover:bg-hover hover:text-ink shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowRightLeftIcon className="size-3 text-signal" />
          <span>Reassign</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 rounded-xl p-1.5">
          <DropdownMenuLabel className="text-[11px] text-ink-3">
            Transfer {task.key} to:
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {liveMemberLoads
            .filter((m) => m.memberId !== currentMemberId)
            .map((target) => (
              <DropdownMenuItem
                key={target.memberId}
                onSelect={() =>
                  onReassign(task.key, target.memberId, target.name)
                }
                className="flex items-center justify-between text-xs py-1.5 cursor-pointer"
              >
                <div className="flex items-center gap-2 truncate">
                  <ActorAvatar name={target.name} size={18} />
                  <span className="truncate">{target.name}</span>
                </div>
                <span
                  className={cn(
                    "font-mono text-[10px] px-1.5 py-0.5 rounded shrink-0 font-medium",
                    target.isOoo
                      ? "text-warning-text bg-warning-subtle border border-warning/20"
                      : target.isUnderutilized
                        ? "text-success-text bg-success-subtle"
                        : target.isOverloaded
                          ? "text-danger-text bg-danger-subtle"
                          : "text-ink-3 bg-sunken",
                  )}
                >
                  {target.isOoo ? "Away" : `${target.openCount} open`}
                </span>
              </DropdownMenuItem>
            ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
