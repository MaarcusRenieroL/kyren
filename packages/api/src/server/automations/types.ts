import type { db as database } from "@kyren/db";

export type Db = any;

export type TriggerEvent =
  | "task.status_changed"
  | "task.subtasks_all_done"
  | "task.blockers_resolved"
  | "task.created"
  | "task.due_date_approaching"
  | "task.sla_breach_risk";

export type TaskContext = {
  id: string;
  key: string;
  status: string;
  projectId: string;
  parentTaskId?: string | null;
  assignedToMemberId?: string | null;
  priority?: string;
};

export type EngineContext = {
  db: Db;
  organizationId: string;
  event: TriggerEvent;
  task: TaskContext;
  actorMemberId?: string | null;
  previousStatus?: string;
};

export type MessageContext = {
  db: Db;
  organizationId: string;
  message: {
    id: string;
    channelId: string;
    parentId: string | null;
    body: string;
    authorMemberId: string | null;
  };
};
