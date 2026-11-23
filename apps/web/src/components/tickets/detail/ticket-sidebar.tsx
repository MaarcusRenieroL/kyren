"use client";

import { Label } from "@kyren/ui/shadcn/label";
import { useState, type FC, type FormEvent } from "react";
import { Button } from "@kyren/ui/shadcn/button";
import { Input } from "@kyren/ui/shadcn/input";
import { NativeSelect } from "@kyren/ui/shadcn/native-select";
import { awayLabel, priorityLabels, statusLabels } from "./../labels";
import type { People, Ticket } from "./types";

type TicketSidebarProps = {
  ticket: Ticket;
  people: People;
  busy: boolean;
  onUpdate: (
    changes: Partial<{
      status: "open" | "pending" | "resolved" | "spam";
      priority: "low" | "normal" | "high" | "urgent";
      assigneeMemberId: string | null;
    }>,
  ) => void;
  onLinkTask: (taskKey: string | null) => Promise<void>;
};

export const TicketSidebar: FC<TicketSidebarProps> = ({
  ticket,
  people,
  busy,
  onUpdate,
  onLinkTask,
}) => {
  const [taskKey, setTaskKey] = useState("");

  const handleLinkSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await onLinkTask(taskKey.trim());
    setTaskKey("");
  };

  return (
    <aside className="flex flex-col gap-4 text-sm">
      <Label className="flex flex-col items-stretch gap-1.5">
        <span className="text-ink-2">Status</span>
        <NativeSelect
          aria-label="Status"
          disabled={!ticket.canUpdate || busy}
          value={ticket.status}
          onChange={(e) => onUpdate({ status: e.target.value as "open" })}
        >
          {Object.entries(statusLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </NativeSelect>
      </Label>
      <Label className="flex flex-col items-stretch gap-1.5">
        <span className="text-ink-2">Priority</span>
        <NativeSelect
          aria-label="Priority"
          disabled={!ticket.canUpdate || busy}
          value={ticket.priority}
          onChange={(e) => onUpdate({ priority: e.target.value as "normal" })}
        >
          {Object.entries(priorityLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </NativeSelect>
      </Label>
      <Label className="flex flex-col items-stretch gap-1.5">
        <span className="text-ink-2">Assignee</span>
        <NativeSelect
          aria-label="Assignee"
          disabled={!ticket.canUpdate || busy}
          value={ticket.assigneeMemberId ?? ""}
          onChange={(e) =>
            onUpdate({ assigneeMemberId: e.target.value || null })
          }
        >
          <option value="">Unassigned</option>
          {people.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name}
              {awayLabel(person.awayUntil)
                ? ` (${awayLabel(person.awayUntil)})`
                : ""}
            </option>
          ))}
        </NativeSelect>
        {awayLabel(ticket.assigneeAwayUntil) ? (
          <span role="status" className="text-xs text-warning-text">
            The assignee is {awayLabel(ticket.assigneeAwayUntil)}. Consider
            reassigning this ticket.
          </span>
        ) : null}
      </Label>

      <div className="flex flex-col gap-1.5">
        <span className="text-ink-2">Linked task</span>
        {ticket.linkedTask ? (
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-ink">
              <span className="font-mono text-xs">{ticket.linkedTask.key}</span>{" "}
              {ticket.linkedTask.name}
            </span>
            {ticket.canUpdate ? (
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => onLinkTask(null)}
              >
                Unlink
              </Button>
            ) : null}
          </div>
        ) : ticket.canUpdate ? (
          <form className="flex gap-2" onSubmit={handleLinkSubmit}>
            <Input
              aria-label="Task key"
              placeholder="ZEN-61"
              value={taskKey}
              onChange={(e) => setTaskKey(e.target.value)}
            />
            <Button
              type="submit"
              variant="outline"
              disabled={busy || !taskKey.trim()}
            >
              Link
            </Button>
          </form>
        ) : (
          <span className="text-ink-3">None</span>
        )}
      </div>

      {ticket.category ? (
        <p className="text-ink-2">
          Category: <span className="text-ink">{ticket.category}</span>
        </p>
      ) : null}
    </aside>
  );
};
