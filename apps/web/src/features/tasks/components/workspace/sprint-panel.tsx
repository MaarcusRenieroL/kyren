"use client";

import { useEffect, useMemo, useState } from "react";

import { useTrpcClient } from "@zentro/api/react";
import type { AppRouter } from "@zentro/api/server";
import type { inferRouterOutputs } from "@trpc/server";
import { toastError, toastSuccess } from "@zentro/ui/index";
import { Button } from "@zentro/ui/shadcn/button";
import { Input } from "@zentro/ui/shadcn/input";
import { NativeSelect } from "@zentro/ui/shadcn/native-select";

import { useAsyncData } from "~/src/lib/use-async-data";
import type { WorkspaceTask } from "~/src/features/tasks/lib/types";
import { getDateInputValue } from "../task-detail/task-detail-utils";

export type SprintScope = "all" | "sprint" | "backlog";

type Sprint = inferRouterOutputs<AppRouter>["sprint"]["list"][number];

const DAY = 86_400_000;
/** Today in the viewer's own time zone. */
const today = () => getDateInputValue(new Date());
const range = (from: string, to: string) => `${from} to ${to}`;

function daysLeft(endsOn: string) {
  return Math.ceil((Date.parse(endsOn) - Date.parse(today())) / DAY);
}

/** A small line chart: work left each day against the straight line to zero. */
function Burndown({
  sprint,
  projectId,
}: {
  sprint: Sprint;
  projectId: string;
}) {
  const trpc = useTrpcClient();
  const data = useAsyncData(
    () =>
      trpc.sprint.burndown.query({
        projectId,
        id: sprint.id,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    [trpc, sprint.id, sprint.doneTasks],
  );

  if (!data.data) return null;

  const { days, total, length, unit } = data.data;
  const w = 320;
  const h = 90;
  const x = (i: number) => (length > 1 ? (i / (length - 1)) * w : 0);
  const y = (v: number) => h - (total > 0 ? (v / total) * h : 0);
  const line = (pick: (d: (typeof days)[number]) => number) =>
    days.map((d, i) => `${x(i)},${y(pick(d))}`).join(" ");

  return (
    <figure className="flex flex-col gap-1">
      <svg
        viewBox={`-4 -4 ${w + 8} ${h + 8}`}
        role="img"
        aria-label={`Burndown: ${days.at(-1)?.remaining ?? total} of ${total} ${unit} left`}
        className="h-24 w-full max-w-sm"
      >
        <polyline
          points={`0,${y(total)} ${w},${y(0)}`}
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.3"
          strokeDasharray="4 3"
        />
        <polyline
          points={line((d) => d.remaining)}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
      </svg>
      <figcaption className="text-xs text-ink-3">
        {days.at(-1)?.remaining ?? total} of {total} {unit} left
      </figcaption>
    </figure>
  );
}

/** The project's real sprints: the running one, planning, closing and its burndown. */
export function SprintPanel({
  projectId,
  tasks,
  scope,
  onScopeChange,
  onActiveSprint,
  onChanged,
}: {
  projectId: string;
  tasks: WorkspaceTask[];
  scope: SprintScope;
  onScopeChange: (scope: SprintScope) => void;
  onActiveSprint: (id: string | null) => void;
  onChanged: () => void;
}) {
  const trpc = useTrpcClient();
  const sprints = useAsyncData(
    () => trpc.sprint.list.query({ projectId }),
    [trpc, projectId],
  );
  const velocity = useAsyncData(
    () => trpc.sprint.velocity.query({ projectId }),
    [trpc, projectId],
  );
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [startsOn, setStartsOn] = useState(today);
  const [endsOn, setEndsOn] = useState(() =>
    getDateInputValue(new Date(Date.now() + 13 * DAY)),
  );
  const [leftover, setLeftover] = useState<"next" | "backlog">("next");
  const [busy, setBusy] = useState(false);

  const list = useMemo(() => sprints.data ?? [], [sprints.data]);
  const active = list.find((s) => s.status === "active");
  const planned = list.filter((s) => s.status === "planned");
  const target = active ?? planned[0];
  const unplanned = tasks.filter((t) => !t.sprintId && t.status !== "done");

  useEffect(() => {
    onActiveSprint(active?.id ?? null);
  }, [active?.id, onActiveSprint]);

  async function run(label: string, action: () => Promise<unknown>) {
    setBusy(true);

    try {
      await action();
      sprints.reload();
      velocity.reload();
      onChanged();
    } catch (error) {
      toastError(error, `Could not ${label}.`);
    } finally {
      setBusy(false);
    }
  }

  const percent = active?.points
    ? Math.round((active.donePoints / active.points) * 100)
    : active?.taskCount
      ? Math.round((active.doneTasks / active.taskCount) * 100)
      : 0;

  return (
    <section
      aria-label="Sprints"
      className="mb-4 flex flex-col gap-3 rounded-2xl border border-hairline/80 bg-surface/80 p-3.5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-ink">
            {active ? active.name : "No sprint running"}
            {active ? (
              <span className="ml-2 rounded-md border border-hairline px-1.5 py-0.5 font-mono text-[10px] text-ink-3">
                {range(active.startsOn, active.endsOn)} ·{" "}
                {Math.max(0, daysLeft(active.endsOn))} days left
              </span>
            ) : null}
          </span>
          {active?.goal ? (
            <span className="text-xs text-ink-2">Goal: {active.goal}</span>
          ) : null}
        </div>

        <div
          role="radiogroup"
          aria-label="Sprint scope"
          className="flex gap-1 rounded-xl border border-hairline bg-surface p-1"
        >
          {(
            [
              ["sprint", "Sprint"],
              ["backlog", "Unplanned"],
              ["all", "All"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={scope === value}
              onClick={() => onScopeChange(value)}
              className={`h-7 rounded-lg px-2.5 text-xs font-medium ${scope === value ? "bg-hover text-ink" : "text-ink-3"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {active ? (
        <div className="flex flex-col gap-1">
          <div
            className="h-1.5 overflow-hidden rounded-full bg-sunken"
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Sprint progress"
          >
            <div
              className="h-full bg-signal"
              style={{ width: `${percent}%` }}
            />
          </div>
          <span className="text-xs text-ink-2">
            {active.doneTasks} of {active.taskCount} tasks done
            {active.points
              ? ` · ${active.donePoints}/${active.points} points`
              : ""}
          </span>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {target && unplanned.length ? (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() =>
              void run("plan the tasks", async () => {
                const keys = unplanned.slice(0, 200).map((t) => t.key);

                await trpc.sprint.assign.mutate({
                  projectId,
                  sprintId: target.id,
                  keys,
                });
                toastSuccess(`Added ${keys.length} tasks to ${target.name}`);
              })
            }
          >
            Add {Math.min(unplanned.length, 200)} unplanned to {target.name}
          </Button>
        ) : null}

        {!active && planned[0] ? (
          <Button
            size="sm"
            disabled={busy}
            onClick={() =>
              void run("start the sprint", () =>
                trpc.sprint.start.mutate({ projectId, id: planned[0]!.id }),
              )
            }
          >
            Start {planned[0].name}
          </Button>
        ) : null}

        {active ? (
          <>
            <label className="flex items-center gap-1.5 text-xs text-ink-2">
              Unfinished work goes to
              <NativeSelect
                aria-label="Unfinished work goes to"
                size="sm"
                className="w-36 text-xs"
                value={leftover}
                onChange={(event) =>
                  setLeftover(event.target.value as "next" | "backlog")
                }
              >
                <option value="next">the next sprint</option>
                <option value="backlog">the backlog</option>
              </NativeSelect>
            </label>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() =>
                void run("complete the sprint", async () => {
                  await trpc.sprint.complete.mutate({
                    projectId,
                    id: active.id,
                    unfinished: leftover,
                  });
                  toastSuccess(`${active.name} completed`);
                })
              }
            >
              Complete sprint
            </Button>
          </>
        ) : null}

        <Button
          size="sm"
          variant="ghost"
          onClick={() => setCreating((value) => !value)}
        >
          New sprint
        </Button>
      </div>

      {creating ? (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void run("create the sprint", async () => {
              await trpc.sprint.create.mutate({
                projectId,
                name,
                startsOn,
                endsOn,
              });
              setName("");
              setCreating(false);
            });
          }}
        >
          <label className="flex flex-col gap-1 text-xs">
            Sprint name
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              maxLength={80}
              className="h-8 w-44"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            Starts
            <Input
              type="date"
              value={startsOn}
              onChange={(event) => setStartsOn(event.target.value)}
              required
              className="h-8"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            Ends
            <Input
              type="date"
              value={endsOn}
              onChange={(event) => setEndsOn(event.target.value)}
              required
              className="h-8"
            />
          </label>
          <Button size="sm" type="submit" disabled={busy || !name.trim()}>
            Create sprint
          </Button>
        </form>
      ) : null}

      {active || (velocity.data?.length ?? 0) > 0 ? (
        <details className="text-sm">
          <summary className="cursor-pointer text-xs text-ink-2">
            Burndown and velocity
          </summary>
          <div className="mt-2 flex flex-wrap gap-6">
            {active ? <Burndown sprint={active} projectId={projectId} /> : null}
            {velocity.data?.length ? (
              <ul className="flex flex-col gap-0.5 text-xs text-ink-2">
                {velocity.data.map((v) => (
                  <li key={v.name}>
                    {v.name}: {v.completedPoints} of {v.committedPoints} points
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </details>
      ) : null}
    </section>
  );
}
