"use client";

import { BotIcon } from "lucide-react";
import { NativeSelect } from "@kyren/ui/shadcn/native-select";

import type { ActionType, TriggerEvent } from "./automation-types";

export function AutomationActionForm({
  actionType,
  setActionType,
  triggerEvent,
  postChannelId,
  setPostChannelId,
  projectId,
  setProjectId,
  canRunEverywhere,
  channels,
  projectOptions,
  targetStatus,
  setTargetStatus,
  priority,
  setPriority,
}: {
  actionType: ActionType;
  setActionType: (a: ActionType) => void;
  triggerEvent: TriggerEvent;
  postChannelId: string;
  setPostChannelId: (id: string) => void;
  projectId: string;
  setProjectId: (id: string) => void;
  canRunEverywhere: boolean;
  channels: Array<{ id: string; name: string }>;
  projectOptions: Array<{ id: string; name: string }>;
  targetStatus: string;
  setTargetStatus: (s: string) => void;
  priority: string;
  setPriority: (p: string) => void;
}) {
  return (
    <div className="rounded-xl border border-hairline/80 bg-surface-subtle/50 p-3 flex flex-col gap-2.5">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-success-text flex items-center gap-1">
        <BotIcon className="size-3" /> Then (Action)
      </span>
      <NativeSelect
        aria-label="Then"
        value={actionType}
        onChange={(e) => setActionType(e.target.value as ActionType)}
      >
        <option value="update_status">Update Task Status</option>
        <option value="assign_actor">
          Auto-Assign Task to Active Member
        </option>
        <option value="set_priority">Set Task Priority</option>
        <option value="post_to_channel">Post a Note to a Chat Channel</option>
        {triggerEvent === "chat.message_contains" ? (
          <option value="create_task">Create a Task from the Message</option>
        ) : null}
      </NativeSelect>

      {actionType === "post_to_channel" ? (
        <NativeSelect
          size="sm"
          value={postChannelId}
          onChange={(e) => setPostChannelId(e.target.value)}
          aria-label="Channel to post in"
        >
          <option value="">Pick a channel…</option>
          {channels.map((channel) => (
            <option key={channel.id} value={channel.id}>
              #{channel.name}
            </option>
          ))}
        </NativeSelect>
      ) : null}

      <NativeSelect
        size="sm"
        value={projectId}
        onChange={(e) => setProjectId(e.target.value)}
        aria-label={
          actionType === "create_task"
            ? "Project for the new tasks"
            : "Project this rule runs on"
        }
      >
        <option value="">
          {canRunEverywhere && actionType !== "create_task"
            ? "All projects"
            : "Pick a project…"}
        </option>
        {projectOptions.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
      </NativeSelect>

      {actionType === "update_status" ? (
        <div className="flex items-center gap-2">
          <span className="text-xs text-ink-3">Target status:</span>
          <NativeSelect
            size="sm"
            aria-label="Target status"
            value={targetStatus}
            onChange={(e) => setTargetStatus(e.target.value)}
          >
            <option value="review">Review</option>
            <option value="in-progress">In Progress</option>
            <option value="done">Done</option>
            <option value="todo">To Do</option>
          </NativeSelect>
        </div>
      ) : null}

      {actionType === "set_priority" ? (
        <div className="flex items-center gap-2">
          <span className="text-xs text-ink-3">Priority:</span>
          <NativeSelect
            size="sm"
            aria-label="Priority to set"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </NativeSelect>
        </div>
      ) : null}
    </div>
  );
}
