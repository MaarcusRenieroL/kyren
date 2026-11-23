"use client";

import { Button } from "@zentro/ui/shadcn/button";
import type { FC } from "react";
import { ChevronDownIcon, ChevronUpIcon, PalmtreeIcon } from "lucide-react";
import { cn } from "@zentro/ui/lib/utils";
import { ActorAvatar } from "~/src/components/actor-avatar";
import type { LiveMemberLoad } from "./types";
import { WorkloadTaskRow } from "./workload-task-row";

type MemberWorkloadCardProps = {
  member: LiveMemberLoad;
  isExpanded: boolean;
  onToggleExpand: () => void;
  togglingOooMemberId: string | null;
  onToggleOoo: (memberId: string, isAway: boolean) => void;
  reassigningKey: string | null;
  liveMemberLoads: LiveMemberLoad[];
  onReassign: (
    taskKey: string,
    targetMemberId: string,
    targetMemberName: string,
  ) => void;
};

export const MemberWorkloadCard: FC<MemberWorkloadCardProps> = ({
  member,
  isExpanded,
  onToggleExpand,
  togglingOooMemberId,
  onToggleOoo,
  reassigningKey,
  liveMemberLoads,
  onReassign,
}) => {
  const assignedTasks = member.assignedTasks;

  return (
    <div
      className={cn(
        "flex flex-col rounded-2xl border transition-all duration-200 overflow-hidden",
        member.isOverloaded
          ? "border-danger/30 bg-danger-subtle/30"
          : "border-hairline bg-surface",
      )}
    >
      {/* Member Row Header */}
      <Button
        variant="custom"
        type="button"
        onClick={onToggleExpand}
        className="flex items-center justify-between gap-3 p-3.5 text-left outline-none hover:bg-hover/60 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3 min-w-0">
          <ActorAvatar name={member.name} size={34} />
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-ink truncate">
                {member.name}
              </span>
              {member.isOoo ? (
                <span className="rounded-md bg-warning-subtle border border-warning/30 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-warning-text flex items-center gap-1">
                  <PalmtreeIcon className="size-3" />
                  OUT OF OFFICE
                </span>
              ) : member.isOverloaded ? (
                <span className="rounded-md bg-danger-subtle border border-danger/30 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-danger-text">
                  OVERLOADED
                </span>
              ) : member.isUnderutilized ? (
                <span className="rounded-md bg-success-subtle border border-success/30 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-success-text">
                  AVAILABLE
                </span>
              ) : null}
            </div>
            <span className="text-xs text-ink-3 font-mono">
              {member.openCount} tasks · {member.totalPoints ?? 0} story points
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          {/* Gauge Bar */}
          <div className="hidden sm:flex flex-col items-end gap-1 w-32">
            <span className="font-mono text-[11px] text-ink-2 font-medium">
              {member.utilizationPercent}% load
            </span>
            <div className="h-1.5 w-full bg-sunken rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-300",
                  member.isOverloaded
                    ? "bg-danger"
                    : (member.utilizationPercent ?? 0) > 80
                      ? "bg-warning"
                      : "bg-success",
                )}
                style={{
                  width: `${Math.min(100, member.utilizationPercent ?? 0)}%`,
                }}
              />
            </div>
          </div>

          {/* Overdue / In Progress pills */}
          <div className="flex items-center gap-1.5">
            {member.overdueCount > 0 ? (
              <span className="rounded bg-danger-subtle px-1.5 py-0.5 font-mono text-[11px] text-danger-text font-medium">
                {member.overdueCount} overdue
              </span>
            ) : null}
            {member.inProgressCount > 0 ? (
              <span className="rounded bg-sunken px-1.5 py-0.5 font-mono text-[11px] text-ink-2">
                {member.inProgressCount} active
              </span>
            ) : null}
          </div>

          <Button
            variant="custom"
            type="button"
            title={member.isOoo ? "Mark as Available" : "Mark as Out of Office"}
            disabled={togglingOooMemberId === member.memberId}
            onClick={(e) => {
              e.stopPropagation();
              onToggleOoo(member.memberId, !member.isOoo);
            }}
            className={cn(
              "flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors shrink-0",
              member.isOoo
                ? "border-warning/30 bg-warning-subtle text-warning-text hover:bg-warning-subtle/80"
                : "border-hairline bg-surface text-ink-3 hover:text-ink hover:bg-hover",
            )}
          >
            <PalmtreeIcon className="size-3" />
            <span>{member.isOoo ? "Away" : "Set Away"}</span>
          </Button>

          {isExpanded ? (
            <ChevronUpIcon className="size-4 text-ink-3" />
          ) : (
            <ChevronDownIcon className="size-4 text-ink-3" />
          )}
        </div>
      </Button>

      {/* Expanded Task List & Reassign Toolbar */}
      {isExpanded ? (
        <div className="flex flex-col border-t border-hairline/60 bg-surface-subtle/30 px-3.5 py-2.5">
          <div className="flex items-center justify-between pb-2 text-xs text-ink-3 font-medium">
            <span>Assigned Tasks ({assignedTasks.length})</span>
            <span className="italic text-[11px]">
              Rebalance by reassigning tasks to other teammates
            </span>
          </div>

          {assignedTasks.length === 0 ? (
            <p className="py-2 text-xs text-ink-3 italic">
              No open tasks assigned.
            </p>
          ) : (
            <div className="flex flex-col divide-y divide-hairline/40">
              {assignedTasks.map((task) => (
                <WorkloadTaskRow
                  key={task.id}
                  task={task}
                  currentMemberId={member.memberId}
                  reassigningKey={reassigningKey}
                  liveMemberLoads={liveMemberLoads}
                  onReassign={onReassign}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};
