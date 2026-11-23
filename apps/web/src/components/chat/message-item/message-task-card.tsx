"use client";

import { Button } from "@kyren/ui/shadcn/button";
import Link from "next/link";
import { useState } from "react";
import { useTrpcClient } from "@kyren/api/react";
import { StatusGlyph } from "@kyren/ui/components/status-glyph";
import { cn } from "@kyren/ui/lib/utils";
import { ActorAvatar } from "~/src/components/actor-avatar";
import { paths } from "~/src/lib/paths";
import { statusLabels, type MessageView } from "./message-item-types";

export function TaskCard({ task }: { task: MessageView["tasks"][number] }) {
  const trpc = useTrpcClient();
  const [currentStatus, setCurrentStatus] = useState(task.status);
  const [loading, setLoading] = useState(false);

  const toggleStatus = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;

    const nextStatus = currentStatus === "done" ? "todo" : "done";
    const prev = currentStatus;
    setCurrentStatus(nextStatus);
    setLoading(true);
    try {
      await trpc.task.updateTaskByKey.mutate({
        key: task.key,
        status: nextStatus,
      });
    } catch {
      setCurrentStatus(prev);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-1.5 flex max-w-md items-center gap-2.5 rounded-lg border border-hairline bg-surface px-3 py-2 outline-none hover:border-ink-3 transition-colors shadow-xs">
      <Button
        variant="custom"
        type="button"
        onClick={toggleStatus}
        aria-label={`Mark task ${task.key} ${currentStatus === "done" ? "to do" : "done"}`}
        className="flex size-5 shrink-0 items-center justify-center rounded hover:bg-hover transition-colors"
      >
        <StatusGlyph status={currentStatus} size={15} decorative />
      </Button>
      <Link
        href={paths.task(task.key)}
        className="flex min-w-0 flex-1 items-center gap-2 outline-none"
      >
        <span className="font-mono text-xs font-semibold text-signal hover:underline">
          {task.key}
        </span>
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-sm font-medium hover:underline",
            currentStatus === "done" && "line-through text-ink-3",
          )}
        >
          {task.name}
        </span>
      </Link>
      <span className="shrink-0 rounded bg-sunken px-1.5 py-0.5 text-[11px] font-medium text-ink-2">
        {statusLabels[currentStatus] ?? currentStatus}
      </span>
      {task.assignee ? <ActorAvatar name={task.assignee} size={20} /> : null}
    </div>
  );
}
