"use client";

import { useEffect, useState } from "react";
import { PlayIcon, SquareIcon, PlusIcon, TimerIcon } from "lucide-react";

import { useTrpcClient } from "@zentro/api/react";
import { toastError, toastSuccess } from "@zentro/ui/index";
import { Button } from "@zentro/ui/shadcn/button";

import type { TaskDetail, TaskTimeLogItem } from "./types";
import { formatMinutes } from "./time-tracker/time-tracker-utils";
import { EstimateSelector } from "./time-tracker/estimate-selector";
import { ManualTimeForm } from "./time-tracker/manual-time-form";
import { TimeLogHistory } from "./time-tracker/time-log-history";

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

      {showManualForm && (
        <ManualTimeForm isLogging={isLogging} onLog={logTime} />
      )}

      <EstimateSelector
        estimatePoints={estimatePoints}
        canEdit={canEdit}
        onEstimateChange={handleEstimateChange}
      />

      <TimeLogHistory timeLogs={timeLogs} />
    </section>
  );
}
