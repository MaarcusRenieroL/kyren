"use client";

import type { FC } from "react";
import { UsersIcon } from "lucide-react";
import type { MemberCapacity, WorkloadTask } from "./workload/types";
import { WorkloadOverviewBar } from "./workload/workload-overview-bar";
import { MemberWorkloadCard } from "./workload/member-workload-card";
import { useWorkloadState } from "./workload/use-workload-state";

export type { MemberCapacity, WorkloadTask };

type Props = {
  teamId: string;
  members: MemberCapacity[];
  tasks: WorkloadTask[];
  onTasksUpdated?: () => void;
};

export const TeamWorkloadBalancer: FC<Props> = ({
  members,
  tasks,
  onTasksUpdated,
}) => {
  const {
    expandedMembers,
    toggleExpand,
    reassigningKey,
    togglingOooMemberId,
    toggleMemberOoo,
    handleReassign,
    openTasks,
    liveMemberLoads,
    overloadedCount,
    underutilizedCount,
    totalOpenPoints,
    avgUtilization,
  } = useWorkloadState({
    members,
    tasks,
    onTasksUpdated,
  });

  return (
    <div className="flex flex-col gap-5">
      {/* Overview Analytics Bar */}
      <WorkloadOverviewBar
        avgUtilization={avgUtilization}
        overloadedCount={overloadedCount}
        underutilizedCount={underutilizedCount}
        openTasksCount={openTasks.length}
        totalOpenPoints={totalOpenPoints}
      />

      {/* Member Heatmap & Rebalance Cards */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UsersIcon className="size-4 text-ink-3" />
            <h3 className="text-sm font-semibold text-ink">
              Member Capacity Matrix
            </h3>
          </div>
          <span className="text-xs text-ink-3">
            Click any teammate to view or reassign their tasks
          </span>
        </div>

        {liveMemberLoads.map((member) => (
          <MemberWorkloadCard
            key={member.memberId}
            member={member}
            isExpanded={
              expandedMembers[member.memberId] ?? member.isOverloaded ?? false
            }
            onToggleExpand={() => toggleExpand(member.memberId)}
            togglingOooMemberId={togglingOooMemberId}
            onToggleOoo={toggleMemberOoo}
            reassigningKey={reassigningKey}
            liveMemberLoads={liveMemberLoads}
            onReassign={handleReassign}
          />
        ))}
      </div>
    </div>
  );
};
