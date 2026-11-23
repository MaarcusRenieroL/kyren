"use client";

import { Input } from "@zentro/ui/shadcn/input";
import { ZapIcon } from "lucide-react";
import { NativeSelect } from "@zentro/ui/shadcn/native-select";

import type { TriggerEvent } from "./automation-types";

export function AutomationTriggerForm({
  triggerEvent,
  setTriggerEvent,
  contains,
  setContains,
  triggerChannelId,
  setTriggerChannelId,
  toStatus,
  setToStatus,
  channels,
}: {
  triggerEvent: TriggerEvent;
  setTriggerEvent: (e: TriggerEvent) => void;
  contains: string;
  setContains: (c: string) => void;
  triggerChannelId: string;
  setTriggerChannelId: (id: string) => void;
  toStatus: string;
  setToStatus: (s: string) => void;
  channels: Array<{ id: string; name: string }>;
}) {
  return (
    <div className="rounded-xl border border-hairline/80 bg-surface-subtle/50 p-3 flex flex-col gap-2.5">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-signal flex items-center gap-1">
        <ZapIcon className="size-3" /> When (Trigger)
      </span>
      <NativeSelect
        aria-label="When"
        value={triggerEvent}
        onChange={(e) => setTriggerEvent(e.target.value as TriggerEvent)}
      >
        <option value="task.subtasks_all_done">
          All Subtasks of a Task are Completed
        </option>
        <option value="task.status_changed">Task Status Changes</option>
        <option value="task.blockers_resolved">
          All Blocking Dependencies are Cleared
        </option>
        <option value="task.created">New Task is Created</option>
        <option value="task.due_date_approaching">
          A Task Is Due Within 24 Hours (or Overdue)
        </option>
        <option value="chat.message_contains">
          A Chat Message Contains Some Words
        </option>
      </NativeSelect>

      {triggerEvent === "chat.message_contains" ? (
        <div className="flex flex-col gap-2">
          <Input
            type="text"
            value={contains}
            onChange={(e) => setContains(e.target.value)}
            placeholder="Words to look for, e.g. bug:"
            aria-label="Words the message contains"
            className="h-8 rounded-lg border border-hairline bg-surface px-2.5 text-xs outline-none"
          />
          <NativeSelect
            size="sm"
            value={triggerChannelId}
            onChange={(e) => setTriggerChannelId(e.target.value)}
            aria-label="Only in this channel"
          >
            <option value="">In any conversation</option>
            {channels.map((channel) => (
              <option key={channel.id} value={channel.id}>
                Only in #{channel.name}
              </option>
            ))}
          </NativeSelect>
        </div>
      ) : null}

      {triggerEvent === "task.status_changed" ? (
        <div className="flex items-center gap-2">
          <span className="text-xs text-ink-3">To status:</span>
          <NativeSelect
            size="sm"
            aria-label="Status it moves to"
            value={toStatus}
            onChange={(e) => setToStatus(e.target.value)}
          >
            <option value="in-progress">In Progress</option>
            <option value="review">Review</option>
            <option value="done">Done</option>
            <option value="todo">To Do</option>
          </NativeSelect>
        </div>
      ) : null}
    </div>
  );
}
