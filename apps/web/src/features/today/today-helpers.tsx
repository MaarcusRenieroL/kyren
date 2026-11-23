"use client";

import { useEffect, useState } from "react";
import { formatDueDate } from "@kyren/utils";
import type { DashboardWorkItem } from "~/src/lib/dashboard-data";

export const dayMs = 86_400_000;

export function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function dueLabel(dueAt: string | null) {
  if (!dueAt) return null;
  const due = formatDueDate(dueAt);
  return {
    text: due.text,
    full: due.full,
    late: due.tone === "overdue",
    tone: due.tone,
  };
}

export function shortAgo(iso: string) {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function clock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = String(Math.floor(total / 3600)).padStart(2, "0");
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

export function RunningTimer({ since }: { since: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <span
      role="timer"
      aria-label="Time on this task"
      suppressHydrationWarning
      className="font-mono text-[34px] leading-none tracking-[-0.03em] text-ink tabular-nums sm:text-[44px]"
    >
      {clock(now - new Date(since).getTime())}
    </span>
  );
}

export const workTint: Record<DashboardWorkItem["kind"], string> = {
  doc: "bg-tint-docs!",
  project: "bg-tint-projects!",
  task: "bg-tint-tasks!",
};
