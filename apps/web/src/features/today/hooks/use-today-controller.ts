"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTrpcClient } from "@zentro/api/react";
import { toastError } from "@zentro/ui/index";
import { type PulseItem } from "@zentro/ui/components/team-pulse";
import { rankTasks } from "@zentro/utils";
import type { TodayData, TodayTask } from "~/src/lib/today-data";
import { everyWhileVisible } from "~/src/lib/poll";
import { dayMs, shortAgo, startOfToday } from "../today-helpers";

export interface UseTodayControllerProps {
  data: TodayData;
}

export function useTodayController({ data }: UseTodayControllerProps) {
  const trpc = useTrpcClient();
  const router = useRouter();
  const [tasks, setTasks] = useState<TodayTask[]>(data.tasks);
  const [done, setDone] = useState(data.doneToday);
  const [timer, setTimer] = useState(data.timer);
  const [celebrating, setCelebrating] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [local, setLocal] = useState<PulseItem[]>([]);
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set());
  const [greeting, setGreeting] = useState<{
    hello: string;
    date: string;
  } | null>(null);

  useEffect(() => {
    const now = new Date();
    const hour = now.getHours();
    const hello = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    const date = now.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }).replace(",", "").toUpperCase();
    setGreeting({ hello, date });
  }, []);

  useEffect(() => {
    return everyWhileVisible(() => router.refresh(), 30_000);
  }, [router]);

  useEffect(() => {
    if (!celebrating) {
      setTasks(data.tasks);
      setDone(data.doneToday);
      setTimer(data.timer);
    }
  }, [data.tasks, data.doneToday, data.timer, celebrating]);

  const ranked = useMemo(() => rankTasks(tasks), [tasks]);
  const focus = ranked[0] ?? null;
  const task = focus?.task ?? null;
  const next = ranked.slice(1, 4);
  const today = startOfToday();

  const dueToday = tasks.filter(
    (item) =>
      item.dueAt &&
      new Date(item.dueAt).getTime() < today + dayMs &&
      new Date(item.dueAt).getTime() >= today,
  ).length;

  const overdue = tasks.filter(
    (item) => item.dueAt && new Date(item.dueAt).getTime() < today,
  ).length;

  const counts = [
    overdue ? `${overdue} overdue` : null,
    dueToday || !overdue ? `${dueToday} due today` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const planned =
    done +
    tasks.filter(
      (item) =>
        item.key === task?.key ||
        item.status === "in-progress" ||
        (item.dueAt && new Date(item.dueAt).getTime() < today + dayMs),
    ).length;

  const running = Boolean(task && timer?.taskKey === task.key);
  const inProgress = tasks.filter(
    (item) => item.status === "in-progress",
  ).length;

  const pulse: PulseItem[] = useMemo(
    () => [
      ...local,
      ...data.pulse.map((item) => ({
        id: item.id,
        actor: item.actor,
        verb: item.verb,
        taskKey: item.taskKey,
        title: item.title,
        href: item.href,
        when: shortAgo(item.at),
      })),
    ],
    [local, data.pulse],
  );

  const announce = useCallback((verb: PulseItem["verb"], item: TodayTask) => {
    const id = `local-${item.key}-${verb}-${Date.now()}`;
    setLocal((current) =>
      [
        {
          id,
          actor: "You",
          verb,
          taskKey: item.key,
          title: item.name,
          href: item.href,
          when: "now",
        },
        ...current,
      ].slice(0, 4),
    );
    setFresh(new Set([id]));
  }, []);

  const setStatus = useCallback(
    async (item: TodayTask, status: "in-progress" | "done") => {
      await trpc.task.updateTaskByKey.mutate({ key: item.key, status });
    },
    [trpc],
  );

  const start = useCallback(async () => {
    if (!task || busy || running) return;
    setBusy(true);
    const previous = { tasks, timer };
    setTasks((current) =>
      current.map((item) =>
        item.key === task.key ? { ...item, status: "in-progress" } : item,
      ),
    );
    setTimer({ taskKey: task.key, startedAt: new Date().toISOString() });

    try {
      if (task.status !== "in-progress") {
        await setStatus(task, "in-progress");
        announce("started", task);
      }
    } catch {
      setTasks(previous.tasks);
      setTimer(previous.timer);
      toastError(
        "Could not start the task",
        "Your change was not saved. Try again in a moment.",
      );
      setBusy(false);
      return;
    }

    try {
      await trpc.timesheet.start.mutate({ key: task.key });
    } catch {
      setTimer(previous.timer);
      toastError(
        "The task is in progress, but the timer did not start",
        "Press Resume to try the timer again.",
      );
    } finally {
      setBusy(false);
    }
  }, [task, busy, running, tasks, timer, announce, setStatus, trpc]);

  const pause = useCallback(async () => {
    if (!task || busy || !running) return;
    setBusy(true);
    const previous = timer;
    setTimer(null);
    try {
      await trpc.timesheet.stop.mutate();
    } catch {
      setTimer(previous);
      toastError(
        "Could not pause the timer",
        "Your change was not saved. Try again in a moment.",
      );
    } finally {
      setBusy(false);
    }
  }, [task, busy, running, timer, trpc]);

  const finish = useCallback(async () => {
    if (!task || busy || celebrating) return;
    setBusy(true);
    setCelebrating(task.key);
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    let logged = false;

    try {
      if (running) {
        await trpc.timesheet.stop.mutate();
        setTimer(null);
        logged = true;
      }
      await setStatus(task, "done");
    } catch {
      setCelebrating(null);
      setBusy(false);
      toastError(
        "Could not mark the task done",
        logged
          ? "Your time was logged, but the task is still open. Try again in a moment."
          : "Your change was not saved. Try again in a moment.",
      );
      return;
    }

    announce("finished", task);
    setTimeout(() => setDone((count) => count + 1), reduced ? 0 : 380);
    setTimeout(
      () => {
        setTasks((current) => current.filter((item) => item.key !== task.key));
        setCelebrating(null);
        setBusy(false);
        router.refresh();
      },
      reduced ? 0 : 900,
    );
  }, [task, busy, celebrating, running, announce, setStatus, router, trpc]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        target?.closest(
          "input, textarea, select, [contenteditable='true'], [role='dialog']",
        )
      ) {
        return;
      }
      if (event.key.toLowerCase() === "s") void (running ? pause() : start());
      if (event.key.toLowerCase() === "d") void finish();
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [running, start, pause, finish]);

  const pullNext = async () => {
    const item = data.unassignedNext;
    if (!item || !data.memberId) return;
    try {
      await trpc.task.updateTaskByKey.mutate({
        key: item.key,
        assignedToMemberId: data.memberId,
      });
      router.refresh();
    } catch {
      toastError(
        "Could not take that task",
        "You may not be allowed to assign tasks here.",
      );
    }
  };

  return {
    router,
    greeting,
    counts,
    tasks,
    task,
    focus,
    next,
    done,
    timer,
    running,
    busy,
    celebrating,
    planned,
    inProgress,
    pulse,
    fresh,
    start,
    pause,
    finish,
    pullNext,
  };
}
