export type Node = {
  id: string;
  key: string;
  title: string;
  status: string;
  priority: string;
  estimatePoints: number | null;
  dueAt: string | null;
  assignee: string;
  teamName: string | null;
  stage: number;
  blocksCount: number;
  blockedByCount: number;
  isCritical: boolean;
  isBottleneck: boolean;
};

export type Edge = {
  sourceKey: string;
  targetKey: string;
  isBlockerDone: boolean;
  isBlockedDone: boolean;
};

export type GraphData = {
  project: { id: string; name: string; slug: string };
  nodes: Node[];
  edges: Edge[];
  criticalPath: string[];
  bottlenecks: string[];
  metrics: {
    totalTasks: number;
    totalDependencies: number;
    criticalPathLength: number;
    blockedTasksCount: number;
    bottlenecksCount: number;
    riskLevel: "low" | "moderate" | "high";
  };
};
