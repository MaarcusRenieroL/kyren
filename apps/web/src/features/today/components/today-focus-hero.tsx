"use client";

import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { Button } from "@zentro/ui/shadcn/button";
import { Kbd } from "@zentro/ui/components/kbd";
import {
  StatusGlyph,
  priorityLabels,
} from "@zentro/ui/components/status-glyph";
import { cn } from "@zentro/ui/lib/utils";
import { describeFocusReason } from "@zentro/utils";
import { CreateTaskModal } from "~/src/features/tasks/components/create-task-modal";
import type { TodayData, TodayTask } from "~/src/lib/today-data";
import { dueLabel, RunningTimer } from "../today-helpers";

type TodayFocusHeroProps = {
  task: TodayTask | null;
  focus: {
    task: TodayTask;
    reason: Parameters<typeof describeFocusReason>[0];
  } | null;
  running: boolean;
  timer: { taskKey: string; startedAt: string } | null;
  busy: boolean;
  celebrating: string | null;
  done: number;
  data: TodayData;
  canAssign: boolean;
  canCreateTask: boolean;
  links: { tasks?: string };
  onStart: () => void;
  onPause: () => void;
  onFinish: () => void;
  onPullNext: () => void;
  onRefresh: () => void;
};

export function TodayFocusHero({
  task,
  focus,
  running,
  timer,
  busy,
  celebrating,
  done,
  data,
  canAssign,
  canCreateTask,
  links,
  onStart,
  onPause,
  onFinish,
  onPullNext,
  onRefresh,
}: TodayFocusHeroProps) {
  const reason = focus ? describeFocusReason(focus.reason) : null;
  const due = task ? dueLabel(task.dueAt) : null;
  const priorityBars =
    task?.priority === "high" ? 3 : task?.priority === "low" ? 1 : 2;
  const startedMs =
    running && timer ? new Date(timer.startedAt).getTime() : null;

  return (
    <section
      data-testid="focus-tile"
      className="tile tile-hero relative col-span-2 flex min-h-[340px] flex-col gap-[18px] overflow-hidden p-[22px] lg:col-span-8 lg:row-span-2 lg:min-h-[400px] lg:px-8 lg:py-7"
    >
      <div
        aria-hidden="true"
        className="halo absolute -top-[220px] -right-[180px] size-[560px]"
      />
      {task ? (
        <div
          key={task.key}
          className="relative flex flex-1 flex-col gap-[18px] motion-safe:animate-fade-up"
        >
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="eyebrow">Focus</span>
            <span className="font-mono text-[13px] text-ink-2">{task.key}</span>
            <span className="flex h-6 items-center gap-1.5 rounded-sm border border-hairline pr-2 pl-1 text-xs text-ink-2">
              <span className="flex size-4 items-center justify-center rounded-[5px] bg-tint-projects font-mono text-[8px] text-ink">
                {task.projectName.charAt(0).toUpperCase()}
              </span>
              {task.projectName}
            </span>
            <span className="flex-1" />
            {due ? (
              <span
                className={cn(
                  "flex h-6 items-center gap-1.5 rounded-sm px-2 font-mono text-xs",
                  due.tone === "overdue"
                    ? "bg-danger-subtle text-danger-text"
                    : due.tone === "soon"
                      ? "bg-warning-subtle text-warning-text"
                      : "bg-sunken text-ink-2",
                )}
                title={due.full}
              >
                {due.tone === "overdue" ? (
                  <span
                    aria-hidden="true"
                    className="size-1.5 rotate-45 rounded-[1px] bg-current"
                  />
                ) : due.tone === "soon" ? (
                  <span
                    aria-hidden="true"
                    className="size-[7px] rounded-full border-[1.5px] border-current"
                  />
                ) : null}
                {due.text}
              </span>
            ) : null}
            <span
              className="flex items-center gap-1.5 text-xs text-ink-2"
              role="img"
              aria-label={`Priority: ${priorityLabels[task.priority] ?? task.priority}`}
            >
              <span
                aria-hidden="true"
                className="flex h-[13px] items-end gap-0.5"
              >
                {[4, 7, 10, 13].map((height, index) => (
                  <span
                    key={height}
                    style={{ height }}
                    className={cn(
                      "w-[3px] rounded-[1px]",
                      index < priorityBars ? "bg-ink" : "bg-hairline",
                    )}
                  />
                ))}
              </span>
              {priorityLabels[task.priority] ?? task.priority}
            </span>
          </div>

          <h2
            className={cn(
              "relative max-w-[680px] font-display text-[2rem] leading-9 tracking-[-0.035em] text-balance text-ink transition-[color,text-decoration-color] duration-200 sm:text-5xl sm:leading-[52px]",
              celebrating === task.key &&
                "text-ink-3 line-through decoration-status-done decoration-2",
            )}
          >
            <Link
              href={task.href}
              className="rounded-md outline-none hover:underline hover:decoration-2 hover:underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring"
            >
              {task.name}
            </Link>
          </h2>
          <p className="relative max-w-[560px] text-[15px] leading-[22px] text-ink-2">
            {reason}
          </p>

          <div className="flex-1" />

          <div className="relative flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-col gap-1.5">
              <span className="eyebrow">Timer</span>
              {running && timer ? (
                <RunningTimer since={timer.startedAt} />
              ) : (
                <span className="font-mono text-[34px] leading-none tracking-[-0.03em] text-ink-3 sm:text-[44px]">
                  00:00:00
                </span>
              )}
              <span className="flex items-center gap-1.5 text-[13px] text-ink-3">
                {running && startedMs ? (
                  <>
                    <StatusGlyph status="in-progress" size={10} decorative />
                    <span suppressHydrationWarning>
                      Running since{" "}
                      {new Date(startedMs).toLocaleTimeString("en-GB", {
                        hour: "numeric",
                        minute: "2-digit",
                        hour12: false,
                      })}
                    </span>
                  </>
                ) : task.status === "in-progress" ? (
                  <>
                    <StatusGlyph status="in-progress" size={10} decorative />
                    In progress, timer paused
                  </>
                ) : (
                  <>
                    <StatusGlyph status="todo" size={10} decorative />
                    Not started
                  </>
                )}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={running ? onPause : onFinish}
                disabled={busy}
                className="h-11 border-hairline bg-transparent px-3.5 text-sm"
              >
                {running ? "Pause" : "Mark done"}
                <Kbd className="ml-1">{running ? "S" : "D"}</Kbd>
              </Button>
              <Button
                onClick={running ? onFinish : onStart}
                loading={running && busy && celebrating === task.key}
                disabled={busy}
                className="h-11 px-4 text-sm font-semibold"
              >
                {running
                  ? "Mark done"
                  : task.status === "in-progress"
                    ? "Resume"
                    : "Start"}
                <Kbd className="ml-1 border-transparent bg-on-signal/20 text-on-signal">
                  {running ? "D" : "S"}
                </Kbd>
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative flex flex-1 flex-col gap-[18px]">
          <span className="eyebrow">Focus</span>
          <div className="flex-1" />
          {data.hasAnyTasks ? (
            <>
              <h2 className="font-display font-semibold text-2xl tracking-tight text-ink sm:text-3xl">
                Nothing left today.
              </h2>
              <p className="max-w-[520px] text-[15px] leading-[22px] text-ink-2">
                {done > 0
                  ? `You finished ${done} ${done === 1 ? "task" : "tasks"} today. The rest of the day is yours.`
                  : "No open tasks are assigned to you."}
              </p>
              {data.unassignedNext && canAssign ? (
                <Button
                  variant="custom"
                  type="button"
                  onClick={onPullNext}
                  className="flex items-center gap-2 self-start rounded-sm text-[15px] text-signal outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Pull {data.unassignedNext.key} “{data.unassignedNext.name}”
                  into today
                  <ArrowRightIcon className="size-3.5" />
                </Button>
              ) : links.tasks ? (
                <Link
                  href={links.tasks}
                  className="flex items-center gap-2 self-start text-[15px] text-signal hover:underline"
                >
                  Look through all tasks
                  <ArrowRightIcon className="size-3.5" />
                </Link>
              ) : null}
            </>
          ) : (
            <>
              <h2 className="font-display font-semibold text-2xl tracking-tight text-ink sm:text-3xl">
                No tasks yet.
              </h2>
              <p className="max-w-[520px] text-[15px] leading-[22px] text-ink-2">
                Tasks you create or get assigned show up here, with the most
                important one in this spot. Each gets a key like ZEN-1.
              </p>
              {canCreateTask ? (
                <div className="flex items-center gap-3.5">
                  <CreateTaskModal onTaskCreated={onRefresh} />
                  <span className="text-[13px] text-ink-3">
                    or press <Kbd>C</Kbd>
                  </span>
                </div>
              ) : null}
            </>
          )}
        </div>
      )}
    </section>
  );
}
