"use client";

import { Button } from "@kyren/ui/shadcn/button";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@kyren/ui/shadcn/collapsible";
import { useEffect, useMemo, useState } from "react";
import { useTrpcClient } from "@kyren/api/react";
import { toastError, toastSuccess } from "@kyren/ui/index";
import { useAsyncData } from "~/src/lib/use-async-data";
import type { WorkspaceTask } from "~/src/features/tasks/lib/types";
import { getDateInputValue } from "../task-detail/task-detail-utils";
import { Burndown } from "./sprint-panel/burndown-chart";
import { CreateSprintForm } from "./sprint-panel/create-sprint-form";
import { SprintActions } from "./sprint-panel/sprint-actions";

export type SprintScope = "all" | "sprint" | "backlog";

const DAY = 86_400_000;
/** Today in the viewer's own time zone. */
const today = () => getDateInputValue(new Date());
const range = (from: string, to: string) => `${from} to ${to}`;

function daysLeft(endsOn: string) {
  return Math.ceil((Date.parse(endsOn) - Date.parse(today())) / DAY);
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
            <Button
              variant="custom"
              key={value}
              type="button"
              role="radio"
              aria-checked={scope === value}
              onClick={() => onScopeChange(value)}
              className={`h-7 rounded-lg px-2.5 text-xs font-medium ${scope === value ? "bg-hover text-ink" : "text-ink-3"}`}
            >
              {label}
            </Button>
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

      <SprintActions
        target={target}
        unplannedCount={unplanned.length}
        active={active}
        plannedFirst={planned[0]}
        busy={busy}
        leftover={leftover}
        setLeftover={setLeftover}
        onAddUnplanned={() =>
          void run("plan the tasks", async () => {
            const keys = unplanned.slice(0, 200).map((t) => t.key);
            await trpc.sprint.assign.mutate({
              projectId,
              sprintId: target!.id,
              keys,
            });
            toastSuccess(`Added ${keys.length} tasks to ${target!.name}`);
          })
        }
        onStartPlanned={() =>
          void run("start the sprint", () =>
            trpc.sprint.start.mutate({ projectId, id: planned[0]!.id }),
          )
        }
        onCompleteActive={() =>
          void run("complete the sprint", async () => {
            await trpc.sprint.complete.mutate({
              projectId,
              id: active!.id,
              unfinished: leftover,
            });
            toastSuccess(`${active!.name} completed`);
          })
        }
        onToggleCreating={() => setCreating((value) => !value)}
      />

      {creating ? (
        <CreateSprintForm
          name={name}
          setName={setName}
          startsOn={startsOn}
          setStartsOn={setStartsOn}
          endsOn={endsOn}
          setEndsOn={setEndsOn}
          busy={busy}
          onSubmit={() => {
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
        />
      ) : null}

      {active || (velocity.data?.length ?? 0) > 0 ? (
        <Collapsible role="group" className="text-sm">
          <CollapsibleTrigger className="w-full text-left before:mr-2 before:inline-block before:content-['▸'] data-[state=open]:before:rotate-90 cursor-pointer text-xs text-ink-2">
            Burndown and velocity
          </CollapsibleTrigger>
          <CollapsibleContent forceMount className="data-[state=closed]:hidden">
            <div className="mt-2 flex flex-wrap gap-6">
              {active ? (
                <Burndown sprint={active} projectId={projectId} />
              ) : null}
              {velocity.data?.length ? (
                <ul className="flex flex-col gap-0.5 text-xs text-ink-2">
                  {velocity.data.map((v) => (
                    <li key={v.name}>
                      {v.name}: {v.completedPoints} of {v.committedPoints}{" "}
                      points
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </CollapsibleContent>
        </Collapsible>
      ) : null}
    </section>
  );
}
