export type TriggerEvent =
  | "task.status_changed"
  | "task.subtasks_all_done"
  | "task.blockers_resolved"
  | "task.created"
  | "task.due_date_approaching"
  | "chat.message_contains";

export type ActionType =
  | "update_status"
  | "assign_actor"
  | "set_priority"
  | "post_to_channel"
  | "create_task";

export type AutomationRule = {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  triggerEvent: string;
  triggerConfig: Record<string, unknown>;
  actionType: string;
  actionConfig: Record<string, unknown>;
  runCount: number;
  lastRunAt: string | Date | null;
  projectId: string | null;
  projectName: string | null;
  createdAt: string | Date;
};

export const TRIGGER_LABELS: Record<string, string> = {
  "task.status_changed": "Status Changed",
  "task.subtasks_all_done": "All Subtasks Completed",
  "task.blockers_resolved": "Blockers Cleared",
  "task.created": "New Task Created",
  "task.due_date_approaching": "SLA & Due Date Approaching (<24h)",
  "task.sla_breach_risk": "SLA Breach Risk",
  "chat.message_contains": "A Chat Message Contains…",
};

export const ACTION_LABELS: Record<string, string> = {
  update_status: "Update Status",
  assign_actor: "Auto-Assign to Actor",
  set_priority: "Set Priority",
  post_to_channel: "Post to a Chat Channel",
  create_task: "Create a Task from the Message",
};
