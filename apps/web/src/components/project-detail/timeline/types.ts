import type { WorkspaceTask } from "~/src/features/tasks/lib/types";

export type DependencyGraphData = {
  criticalPath: string[];
  bottlenecks: string[];
  nodes: Array<{
    key: string;
    stage: number;
    isCritical: boolean;
    isBottleneck: boolean;
  }>;
};

export type TimelineScale = "days" | "weeks";

export type TimelineTask = WorkspaceTask & {
  computedStart: Date;
  computedDue: Date;
  startPercent: number;
  widthPercent: number;
  isCritical: boolean;
};

export type TimeBucket = {
  date: Date;
  label: string;
  subLabel: string;
  isToday: boolean;
};
