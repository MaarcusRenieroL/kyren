"use client";

import { Button } from "@kyren/ui/shadcn/button";
import { useEffect, useMemo, useState } from "react";

import { useTrpcClient } from "@kyren/api/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@kyren/ui/shadcn/dialog";
import { Input } from "@kyren/ui/shadcn/input";

export type PickedTask = { key: string; name: string; status: string };

/** Finds a task (among those the person may see) to put on the board. */
export function TaskPicker({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (task: PickedTask) => void;
}) {
  const trpc = useTrpcClient();
  const [tasks, setTasks] = useState<PickedTask[] | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) return;

    setQuery("");
    trpc.task.getTasksByOrgId
      .query({})
      .then((rows) =>
        setTasks(
          rows.map((row) => ({
            key: row.key,
            name: row.name,
            status: row.status,
          })),
        ),
      )
      .catch(() => setTasks([]));
  }, [open, trpc]);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return (tasks ?? [])
      .filter(
        (task) =>
          !needle ||
          task.key.toLowerCase().includes(needle) ||
          task.name.toLowerCase().includes(needle),
      )
      .slice(0, 30);
  }, [tasks, query]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a task card</DialogTitle>
          <DialogDescription>
            The card links to the task, so anyone can open it from the board.
          </DialogDescription>
        </DialogHeader>
        <Input
          autoFocus
          aria-label="Find a task"
          placeholder="Search by key or name"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {tasks === null ? (
          <p role="status" className="text-sm text-ink-2">
            Loading tasks…
          </p>
        ) : shown.length ? (
          <ul className="max-h-72 divide-y divide-line overflow-y-auto rounded-lg border border-line">
            {shown.map((task) => (
              <li key={task.key}>
                <Button
                  variant="custom"
                  type="button"
                  className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-hover"
                  onClick={() => onPick(task)}
                >
                  <span className="font-mono text-xs text-ink-3">
                    {task.key}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-ink">
                    {task.name}
                  </span>
                  <span className="text-xs text-ink-2">{task.status}</span>
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-2">No tasks match.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
