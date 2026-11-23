import { useMemo } from "react";
import type { WorkspaceTask } from "~/src/features/tasks/lib/types";
import type { TimeBucket, TimelineScale, TimelineTask } from "./types";

type UseTimelineLayoutParams = {
  tasks: WorkspaceTask[];
  scale: TimelineScale;
  offsetWeeks: number;
  criticalSet: Set<string>;
};

export function useTimelineLayout({
  tasks,
  scale,
  offsetWeeks,
  criticalSet,
}: UseTimelineLayoutParams) {
  // Establish base reference window around today
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const totalDays = scale === "days" ? 21 : 56;
  const daysBeforeToday = scale === "days" ? 5 : 14;

  const startDate = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() - daysBeforeToday + offsetWeeks * 7);
    return d;
  }, [today, daysBeforeToday, offsetWeeks]);

  const endDate = useMemo(() => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + totalDays);
    return d;
  }, [startDate, totalDays]);

  // Generate day/week column buckets
  const timeBuckets: TimeBucket[] = useMemo(() => {
    const buckets: TimeBucket[] = [];
    const current = new Date(startDate);

    if (scale === "days") {
      for (let i = 0; i < totalDays; i++) {
        const isToday = current.getTime() === today.getTime();
        buckets.push({
          date: new Date(current),
          label: current.toLocaleDateString("en-US", { weekday: "narrow" }),
          subLabel: `${current.getDate()}`,
          isToday,
        });
        current.setDate(current.getDate() + 1);
      }
    } else {
      const numWeeks = Math.floor(totalDays / 7);
      for (let i = 0; i < numWeeks; i++) {
        const weekEnd = new Date(current);
        weekEnd.setDate(weekEnd.getDate() + 6);
        const isCurrentWeek =
          today.getTime() >= current.getTime() &&
          today.getTime() <= weekEnd.getTime();

        buckets.push({
          date: new Date(current),
          label: current.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          }),
          subLabel: `W${i + 1}`,
          isToday: isCurrentWeek,
        });
        current.setDate(current.getDate() + 7);
      }
    }

    return buckets;
  }, [startDate, totalDays, scale, today]);

  // Map each task to a timeline position [startPercent, widthPercent]
  const timelineTasks: TimelineTask[] = useMemo(() => {
    const totalMs = endDate.getTime() - startDate.getTime();

    return tasks.map((task, idx) => {
      let taskDue: Date;
      if (task.dueAt) {
        taskDue = new Date(task.dueAt);
        taskDue.setHours(0, 0, 0, 0);
      } else {
        taskDue = new Date(today);
        taskDue.setDate(taskDue.getDate() + 3 + (idx % 7));
      }

      const durationDays = Math.max(1, Math.min(10, task.estimatePoints ?? 2));
      const taskStart = new Date(taskDue);
      taskStart.setDate(taskStart.getDate() - durationDays);

      const startOffsetMs = taskStart.getTime() - startDate.getTime();
      const endOffsetMs = taskDue.getTime() - startDate.getTime();

      const startPercent = Math.max(
        0,
        Math.min(100, (startOffsetMs / totalMs) * 100),
      );
      const endPercent = Math.max(
        0,
        Math.min(100, (endOffsetMs / totalMs) * 100),
      );
      const widthPercent = Math.max(2.5, endPercent - startPercent);

      const isCritical = criticalSet.has(task.key);

      return {
        ...task,
        computedStart: taskStart,
        computedDue: taskDue,
        startPercent,
        widthPercent,
        isCritical,
      };
    });
  }, [tasks, startDate, endDate, today, criticalSet]);

  return {
    timeBuckets,
    timelineTasks,
  };
}
