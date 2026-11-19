"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { useTrpcClient } from "@zentro/api/react";
import type { AppRouter } from "@zentro/api/server";
import type { inferRouterOutputs } from "@trpc/server";
import { toastError } from "@zentro/ui/index";
import { Button } from "@zentro/ui/shadcn/button";
import { getDateInputValue } from "../task-detail/task-detail-utils";

type Outputs = inferRouterOutputs<AppRouter>["timesheet"];

const DAY = 86_400_000;

const hours = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;

  if (!h) return `${m}m`;

  return m ? `${h}h ${m}m` : `${h}h`;
};

/** Monday of the week that holds `date`, as a UTC day. */
function weekStart(date: Date) {
  const day = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const offset = (day.getUTCDay() + 6) % 7;

  return new Date(day.getTime() - offset * DAY);
}

const iso = (date: Date) => date.toISOString().slice(0, 10);

/** "Mon 16 Nov": the days are calendar days, so they are read in UTC. */
const dayLabel = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const shown = (day: string) => dayLabel.format(new Date(`${day}T00:00:00Z`));

/** Your logged time for a week, and for people who may, everyone's. */
export function Timesheet({ canSeeReport }: { canSeeReport: boolean }) {
  const trpc = useTrpcClient();
  const [start, setStart] = useState(() =>
    // The viewer's own today, then the week math in UTC like the stored days.
    weekStart(new Date(getDateInputValue(new Date()))),
  );
  const [mine, setMine] = useState<Outputs["mine"] | null>(null);
  const [report, setReport] = useState<Outputs["report"] | null>(null);

  const from = iso(start);
  const to = iso(new Date(start.getTime() + 6 * DAY));

  const load = useCallback(async () => {
    try {
      // Days start at the viewer's own midnight, not UTC's.
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      setMine(await trpc.timesheet.mine.query({ from, to, timeZone }));

      if (canSeeReport) {
        setReport(await trpc.timesheet.report.query({ from, to, timeZone }));
      }
    } catch (error) {
      toastError(error, "Could not load the timesheet.");
    }
  }, [trpc, from, to, canSeeReport]);

  useEffect(() => {
    void load();
  }, [load]);

  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const day = iso(new Date(start.getTime() + i * DAY));
        const entries = (mine?.entries ?? []).filter((e) => e.day === day);

        return {
          day,
          entries,
          minutes: entries.reduce((sum, e) => sum + e.minutes, 0),
        };
      }),
    [mine, start],
  );

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">Timesheet</h1>
          <p className="text-sm text-ink-2">
            Time you logged on tasks, {shown(from)} to {shown(to)}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setStart(new Date(start.getTime() - 7 * DAY))}
          >
            Previous week
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setStart(weekStart(new Date()))}
          >
            This week
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setStart(new Date(start.getTime() + 7 * DAY))}
          >
            Next week
          </Button>
        </div>
      </header>

      <section aria-label="Your week" className="tile px-5 py-4">
        <p className="mb-3 text-sm font-medium text-ink">
          Total this week: {hours(mine?.totalMinutes ?? 0)}
        </p>
        <ul className="flex flex-col divide-y divide-line">
          {days.map(({ day, entries, minutes }) => (
            <li key={day} className="py-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink">{shown(day)}</span>
                <span className="font-mono text-ink-2">{hours(minutes)}</span>
              </div>
              {entries.length ? (
                <ul className="mt-1 flex flex-col gap-0.5">
                  {entries.map((entry) => (
                    <li
                      key={entry.id}
                      className="flex justify-between gap-3 text-xs text-ink-2"
                    >
                      <span className="min-w-0 truncate">
                        <Link
                          href={`/tasks/${entry.taskKey}`}
                          className="font-medium text-ink hover:underline"
                        >
                          {entry.taskKey}
                        </Link>{" "}
                        {entry.taskName}
                        {entry.note ? ` — ${entry.note}` : ""}
                      </span>
                      <span className="shrink-0 font-mono">
                        {hours(entry.minutes)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      {canSeeReport && report ? (
        <section aria-label="Team report" className="tile px-5 py-4">
          <h2 className="mb-2 text-sm font-semibold text-ink">
            Everyone, this week: {hours(report.totalMinutes)}
          </h2>
          <div className="grid gap-6 sm:grid-cols-2">
            <ul className="flex flex-col gap-1 text-sm">
              {report.people.map((person) => (
                <li key={person.name} className="flex justify-between">
                  <span>{person.name}</span>
                  <span className="font-mono text-ink-2">
                    {hours(person.minutes)}
                  </span>
                </li>
              ))}
            </ul>
            <ul className="flex flex-col gap-1 text-sm">
              {report.tasks.map((task) => (
                <li key={task.key} className="flex justify-between gap-3">
                  <span className="min-w-0 truncate">
                    {task.key} {task.name}
                  </span>
                  <span className="shrink-0 font-mono text-ink-2">
                    {hours(task.minutes)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}
    </div>
  );
}
