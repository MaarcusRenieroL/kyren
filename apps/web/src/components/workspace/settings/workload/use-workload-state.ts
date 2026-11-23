"use client";

import { useEffect, useState } from "react";
import { useTrpcClient } from "@kyren/api/react";
import { toastError, toastSuccess } from "@kyren/ui/index";
import type { LiveMemberLoad, MemberCapacity, WorkloadTask } from "./types";

type UseWorkloadStateParams = {
  members: MemberCapacity[];
  tasks: WorkloadTask[];
  onTasksUpdated?: () => void;
};

export function useWorkloadState({
  members,
  tasks,
  onTasksUpdated,
}: UseWorkloadStateParams) {
  const trpc = useTrpcClient();
  const [expandedMembers, setExpandedMembers] = useState<
    Record<string, boolean>
  >({});
  const [localTasks, setLocalTasks] = useState<WorkloadTask[]>(tasks);
  const [reassigningKey, setReassigningKey] = useState<string | null>(null);
  const [oooMembers, setOooMembers] = useState<
    Record<string, { untilDate?: string | null }>
  >({});
  const [togglingOooMemberId, setTogglingOooMemberId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    let isMounted = true;
    trpc.member.getOutOfOffice
      .query()
      .then((list) => {
        if (!isMounted) return;
        const map: Record<string, { untilDate?: string | null }> = {};
        for (const item of list) {
          map[item.memberId] = { untilDate: item.untilDate };
        }
        setOooMembers(map);
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [trpc]);

  // Sync tasks when props change
  useEffect(() => {
    setLocalTasks(tasks);
  }, [tasks]);

  const toggleMemberOoo = async (memberId: string, isAway: boolean) => {
    if (togglingOooMemberId) return;
    setTogglingOooMemberId(memberId);

    const prev = { ...oooMembers };
    setOooMembers((current) => {
      const next = { ...current };
      if (isAway) {
        next[memberId] = { untilDate: null };
      } else {
        delete next[memberId];
      }
      return next;
    });

    try {
      await trpc.member.toggleOutOfOffice.mutate({
        memberId,
        isOutOfOffice: isAway,
      });
      toastSuccess(
        isAway ? "Teammate marked Out of Office" : "Teammate marked Available",
      );
    } catch {
      setOooMembers(prev);
      toastError("Error", "Could not update Out of Office status");
    } finally {
      setTogglingOooMemberId(null);
    }
  };

  const toggleExpand = (memberId: string) => {
    setExpandedMembers((prev) => ({
      ...prev,
      [memberId]: !prev[memberId],
    }));
  };

  const handleReassign = async (
    taskKey: string,
    targetMemberId: string,
    targetMemberName: string,
  ) => {
    if (reassigningKey) return;
    setReassigningKey(taskKey);

    // Optimistic local state update
    const prevTasks = [...localTasks];
    setLocalTasks((prev) =>
      prev.map((t) =>
        t.key === taskKey
          ? {
              ...t,
              assignedToMemberId: targetMemberId,
              assigneeName: targetMemberName,
            }
          : t,
      ),
    );

    try {
      await trpc.task.updateTaskByKey.mutate({
        key: taskKey,
        assignedToMemberId: targetMemberId,
      });
      toastSuccess(`Reassigned ${taskKey} to ${targetMemberName}`);
      onTasksUpdated?.();
    } catch {
      setLocalTasks(prevTasks);
      toastError("Error", `Could not reassign task ${taskKey}`);
    } finally {
      setReassigningKey(null);
    }
  };

  // Recompute live member loads based on local tasks
  const openTasks = localTasks.filter((t) => t.status !== "done");
  const liveMemberLoads: LiveMemberLoad[] = members.map((member) => {
    const assigned = openTasks.filter(
      (t) => t.assignedToMemberId === member.memberId,
    );
    const inProgress = assigned.filter(
      (t) => t.status === "in-progress",
    ).length;
    const overdue = assigned.filter(
      (t) => t.dueAt && new Date(t.dueAt).getTime() < Date.now(),
    ).length;
    const points = assigned.reduce(
      (sum, t) => sum + (t.estimatePoints ?? 0),
      0,
    );
    const utilization = Math.min(200, Math.round((assigned.length / 5) * 100));
    const isOoo = Boolean(oooMembers[member.memberId]);

    return {
      ...member,
      openCount: assigned.length,
      inProgressCount: inProgress,
      overdueCount: overdue,
      totalPoints: points,
      utilizationPercent: utilization,
      isOverloaded: assigned.length > 5 || overdue > 1,
      isUnderutilized: assigned.length <= 1,
      isOoo,
      oooInfo: oooMembers[member.memberId],
      assignedTasks: assigned,
    };
  });

  const overloadedCount = liveMemberLoads.filter((m) => m.isOverloaded).length;
  const underutilizedCount = liveMemberLoads.filter(
    (m) => m.isUnderutilized,
  ).length;
  const totalOpenPoints = openTasks.reduce(
    (sum, t) => sum + (t.estimatePoints ?? 0),
    0,
  );
  const avgUtilization = liveMemberLoads.length
    ? Math.round(
        liveMemberLoads.reduce(
          (sum, m) => sum + (m.utilizationPercent ?? 0),
          0,
        ) / liveMemberLoads.length,
      )
    : 0;

  return {
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
  };
}
