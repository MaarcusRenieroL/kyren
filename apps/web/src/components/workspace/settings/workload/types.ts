export type MemberCapacity = {
  memberId: string;
  userId: string;
  name: string;
  openCount: number;
  inProgressCount: number;
  overdueCount: number;
  totalPoints?: number;
  utilizationPercent?: number;
  isOverloaded?: boolean;
  isUnderutilized?: boolean;
};

export type WorkloadTask = {
  id: string;
  key: string;
  name: string;
  status: string;
  priority: string | null;
  estimatePoints?: number | null;
  dueAt: Date | string | null;
  projectId: string;
  projectName: string;
  projectSlug: string;
  assignedToMemberId: string | null;
  assigneeName: string | null;
  createdAt: Date | string;
};

export type LiveMemberLoad = MemberCapacity & {
  isOoo: boolean;
  oooInfo?: { untilDate?: string | null };
  assignedTasks: WorkloadTask[];
};
