import type {
  MemberCapacity,
  WorkloadTask,
} from "../team-workload-balancer";

export type WorkloadData = {
  team: {
    id: string;
    name: string;
  };
  totalTasks: number;
  openTasksCount: number;
  doneTasksCount: number;
  memberWorkload: MemberCapacity[];
  tasks: WorkloadTask[];
};

export type TeamDetailData = {
  team: {
    id: string;
    name: string;
    description: string | null;
    members: Array<{
      memberId: string;
      userId: string;
      name: string;
      role: string;
    }>;
  };
  projects: Array<{
    id: string;
    name: string;
    slug: string;
    taskKeyPrefix: string;
    totalTasks: number | null;
    doneTasks: number | null;
  }>;
  tasks: Array<{
    key: string;
    name: string;
    status: string;
    due: Date | null;
    assigneeUserId: string | null;
  }>;
  docs: Array<{ updatedAt: Date }>;
  workload: WorkloadData | null;
};

export const DAY = 24 * 60 * 60 * 1000;
