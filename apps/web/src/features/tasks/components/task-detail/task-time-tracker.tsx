"use client";

import { useEffect, useState } from "react";
import {
  ClockIcon,
  PlayIcon,
  SquareIcon,
  PlusIcon,
  TimerIcon,
  HashIcon,
} from "lucide-react";

import { useTrpcClient } from "@zentro/api/react";
import { toastError, toastSuccess } from "@zentro/ui/index";
import { cn } from "@zentro/ui/lib/utils";
import { Button } from "@zentro/ui/shadcn/button";

import type { TaskDetail, TaskTimeLogItem } from "./types";

function formatMinutes(totalMinutes: number): string {
  if (totalMinutes <= 0) return "0m";
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h`;
  return `${mins}m`;
}

export function TaskTimeTracker({
  task,
  canEdit,
  onTaskUpdated,
}: {
  task: TaskDetail;
  canEdit: boolean;
  onTaskUpdated?: () => void;
}) {
  const trpc = useTrpcClient();
  const [seconds, setSeconds] = useState(0);
  const [manualMinutes, setManualMinutes] = useState("");
  const [manualNote, setManualNote] = useState("");
  const [isLogging, setIsLogging] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [timeLogs, setTimeLogs] = useState<TaskTimeLogItem[]>(
    task.timeLogs ?? [],
  );
  const [totalMinutes, setTotalMinutes] = useState(task.timeSpentMinutes ?? 0);
  const [estimatePoints, setEstimatePoints] = useState<number | null>(
    task.estimatePoints ?? null,
  );

  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elsewhere, setElsewhere] = useState<string | null>(null);

  // The timer lives on the server, so a refresh or another tab sees it too.
  useEffect(() => {
    let alive = true;

    trpc.timesheet.running
      .query()
      .then((timer) => {
        if (!alive) return;

        if (timer?.taskKey === task.key) {
          setStartedAt(new Date(timer.startedAt).getTime());
          setElsewhere(null);
        } else {
          setStartedAt(null);
          setElsewhere(timer?.taskKey ?? null);
        }
      })
      .catch(() => undefined);

    return () => {
      alive = false;
    };
  }, [trpc, task.key]);

  const isRunning = startedAt !== null;

  useEffect(() => {
    if (startedAt === null) {
      setSeconds(0);

      return;
    }

    const tick = () =>
      setSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));

    tick();

    const interval = setInterval(tick, 1000);

    return () => clearInterval(interval);
  }, [startedAt]);

  const timerDisplay = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  async function handleStart() {
    try {
      await trpc.timesheet.start.mutate({ key: task.key });
      setStartedAt(Date.now());
      setElsewhere(null);
    } catch {
      toastError("Error", "Could not start the timer");
    }
  }

  async function handleStop() {
    try {
      const stopped = await trpc.timesheet.stop.mutate();

      setStartedAt(null);

      if (stopped) {
        setTotalMinutes(stopped.totalTimeSpentMinutes);
        toastSuccess(`Logged ${formatMinutes(stopped.minutes)}`);
        onTaskUpdated?.();
      }
    } catch {
      toastError("Error", "Could not stop the timer");
    }
  }

  async function logTime(duration: number, note?: string) {
    if (duration <= 0 || isLogging) return;
    setIsLogging(true);
    try {
      const res = await trpc.task.logTime.mutate({
        key: task.key,
        durationMinutes: duration,
        note: note || null,
      });

      setTotalMinutes(res.totalTimeSpentMinutes);
      if (res.log) {
        setTimeLogs((prev) => [
          {
            id: res.log.id,
            durationMinutes: res.log.durationMinutes,
            note: res.log.note,
            createdAt: new Date(res.log.createdAt),
            userName: "You",
          },
          ...prev,
        ]);
      }
      setManualMinutes("");
      setManualNote("");
      setShowManualForm(false);
      toastSuccess(`Logged ${formatMinutes(duration)}`);
      onTaskUpdated?.();
    } catch {
      toastError("Error", "Could not save logged time");
    } finally {
      setIsLogging(false);
    }
  }

  async function handleEstimateChange(points: number | null) {
    setEstimatePoints(points);
    try {
      await trpc.task.updateTaskByKey.mutate({
        key: task.key,
        estimatePoints: points,
      });
      toastSuccess(points ? `Estimated: ${points} pts` : "Estimate cleared");
      onTaskUpdated?.();
    } catch {
      toastError("Error", "Could not update estimate");
      setEstimatePoints(task.estimatePoints ?? null);
    }
  }

  const pointOptions = [1, 2, 3, 5, 8, 13];

  return (
    <section aria-label="Time & Estimation" className="tile p-5">
      <div className="flex items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <TimerIcon className="size-4 text-ink-3" aria-hidden="true" />
          <h2 className="eyebrow text-ink">Time & Estimate</h2>
        </div>
        <span className="font-mono text-xs font-medium text-ink-2">
          {formatMinutes(totalMinutes)} logged
        </span>
      </div>

      {/* Stopwatch & Action Bar */}
      <div className="flex flex-wrap items-center gap-2 pt-1 pb-3">
        {isRunning ? (
          <Button
            size="sm"
            variant="destructive"
            onClick={() => void handleStop()}
            className="h-8 gap-2 font-mono text-xs"
          >
            <SquareIcon className="size-3 fill-current" />
            <span>Stop ({timerDisplay})</span>
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => void handleStart()}
            className="h-8 gap-1.5 font-mono text-xs"
          >
            <PlayIcon className="size-3 fill-current text-success" />
            <span>{elsewhere ? "Switch timer here" : "Start Timer"}</span>
          </Button>
        )}
        {elsewhere && !isRunning ? (
          <span className="text-xs text-ink-3">
            Timer running on {elsewhere}
          </span>
        ) : null}

        <Button
          size="sm"
          variant="ghost"
          onClick={() => setShowManualForm((v) => !v)}
          className="h-8 gap-1 text-xs text-ink-2 hover:text-ink"
        >
          <PlusIcon className="size-3.5" />
          <span>Manual Entry</span>
        </Button>
      </div>

      {/* Manual Time Logging Form */}
      {showManualForm && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const mins = parseInt(manualMinutes, 10);
            if (!isNaN(mins) && mins > 0) {
              void logTime(mins, manualNote);
            }
          }}
          className="mb-4 flex flex-col gap-2 rounded-lg border border-hairline bg-surface-subtle p-3"
        >
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="1"
              max="1440"
              value={manualMinutes}
              onChange={(e) => setManualMinutes(e.target.value)}
              placeholder="Minutes (e.g. 45)"
              className="h-8 w-36 rounded-md border border-hairline bg-surface px-2.5 font-mono text-xs outline-none focus-visible:border-ring"
              autoFocus
            />
            <input
              type="text"
              value={manualNote}
              onChange={(e) => setManualNote(e.target.value)}
              placeholder="Optional note"
              className="h-8 flex-1 rounded-md border border-hairline bg-surface px-2.5 text-xs outline-none focus-visible:border-ring"
            />
            <Button
              size="sm"
              type="submit"
              disabled={isLogging || !manualMinutes}
              className="h-8 text-xs"
            >
              Log
            </Button>
          </div>
        </form>
      )}

      {/* Story Points Estimation Selector */}
      <div className="mt-2 flex flex-col gap-1.5 border-t border-hairline pt-3">
        <span className="flex items-center gap-1.5 font-mono text-[11px] text-ink-3 uppercase tracking-wider">
          <HashIcon className="size-3" />
          Story Points Estimate
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          {pointOptions.map((pts) => {
            const isSelected = estimatePoints === pts;
            return (
              <button
                key={pts}
                type="button"
                disabled={!canEdit}
                onClick={() => handleEstimateChange(isSelected ? null : pts)}
                className={cn(
                  "flex size-7 items-center justify-center rounded border font-mono text-xs transition-colors",
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground font-semibold"
                    : "border-hairline bg-surface hover:bg-hover text-ink-2",
                )}
              >
                {pts}
              </button>
            );
          })}
          {estimatePoints !== null &&
            !pointOptions.includes(estimatePoints) && (
              <span className="rounded border border-primary bg-primary px-2 py-1 font-mono text-xs text-primary-foreground">
                {estimatePoints} pts
              </span>
            )}
        </div>
      </div>

      {/* Recent Time Logs */}
      {timeLogs.length > 0 && (
        <div className="mt-4 flex flex-col gap-1.5 border-t border-hairline pt-3">
          <span className="font-mono text-[11px] text-ink-3 uppercase tracking-wider">
            History ({timeLogs.length})
          </span>
          <div className="flex flex-col divide-y divide-hairline/60">
            {timeLogs.slice(0, 5).map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between py-1.5 text-xs"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <ClockIcon className="size-3 text-ink-3 shrink-0" />
                  <span className="truncate text-ink-2">
                    {log.note || "Logged work"}
                  </span>
                </div>
                <span className="font-mono text-[11px] font-medium text-ink shrink-0">
                  {formatMinutes(log.durationMinutes)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
