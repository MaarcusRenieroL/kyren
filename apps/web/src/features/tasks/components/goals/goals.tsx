"use client";

import { useState } from "react";

import { useTrpcClient } from "@zentro/api/react";
import { toastError, toastSuccess } from "@zentro/ui/index";
import { Button } from "@zentro/ui/shadcn/button";
import { Input } from "@zentro/ui/shadcn/input";

import { useAsyncData } from "~/src/lib/use-async-data";

const percent = (value: number) => `${Math.round(value * 100)}%`;

function Bar({ value, label }: { value: number; label: string }) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(value * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      className="h-2 w-full overflow-hidden rounded-full bg-hairline"
    >
      <div className="h-full bg-accent" style={{ width: percent(value) }} />
    </div>
  );
}

/** Goals for a period, each measured by key results. */
export function Goals({ canManage }: { canManage: boolean }) {
  const trpc = useTrpcClient();
  const [version, setVersion] = useState(0);
  const goals = useAsyncData(() => trpc.goals.list.query(), [trpc, version]);
  const [title, setTitle] = useState("");
  const [period, setPeriod] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(work: () => Promise<unknown>, done: string) {
    setBusy(true);

    try {
      await work();
      toastSuccess(done);
      setVersion((v) => v + 1);
    } catch (error) {
      toastError(error, "Could not change the goal.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold text-ink">Goals</h1>

      {canManage ? (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void run(async () => {
              await trpc.goals.saveObjective.mutate({
                title,
                period: period || null,
                status: "active",
              });
              setTitle("");
              setPeriod("");
            }, "Goal added");
          }}
        >
          <Input
            aria-label="Goal title"
            placeholder="Goal, e.g. Grow revenue"
            maxLength={160}
            className="min-w-48 flex-1"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Input
            aria-label="Goal period"
            placeholder="Period, e.g. Q4 2026"
            maxLength={40}
            className="w-40"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          />
          <Button type="submit" disabled={busy || !title.trim()}>
            Add goal
          </Button>
        </form>
      ) : null}

      {goals.data && goals.data.length === 0 ? (
        <p className="text-sm text-ink-2">No goals yet.</p>
      ) : null}

      {(goals.data ?? []).map((goal) => (
        <section
          key={goal.id}
          className="flex flex-col gap-3 rounded-xl border border-line p-4"
        >
          <div className="flex items-baseline gap-2">
            <h2 className="flex-1 text-base font-medium text-ink">
              {goal.title}
            </h2>
            {goal.period ? (
              <span className="text-xs text-ink-2">{goal.period}</span>
            ) : null}
            <span className="text-sm font-medium text-ink">
              {percent(goal.progress)}
            </span>
            {canManage ? (
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                aria-label={`Delete goal ${goal.title}`}
                onClick={() =>
                  void run(
                    () => trpc.goals.removeObjective.mutate({ id: goal.id }),
                    "Goal deleted",
                  )
                }
              >
                Delete
              </Button>
            ) : null}
          </div>
          <Bar value={goal.progress} label={`${goal.title} progress`} />

          <ul className="flex flex-col gap-3">
            {goal.keyResults.map((kr) => (
              <li key={kr.id} className="flex flex-col gap-1 text-sm">
                <div className="flex items-center gap-2">
                  <span className="flex-1 text-ink">{kr.title}</span>
                  <span className="text-xs text-ink-2">
                    {kr.kind === "tasks"
                      ? `${kr.doneTasks} of ${kr.totalTasks} tasks`
                      : `${kr.currentValue} of ${kr.targetValue}${
                          kr.unit ? ` ${kr.unit}` : ""
                        }`}
                  </span>
                  <span className="w-10 text-right text-ink">
                    {percent(kr.progress)}
                  </span>
                </div>
                <Bar value={kr.progress} label={`${kr.title} progress`} />
              </li>
            ))}
          </ul>

          {canManage ? (
            <KeyResultForm
              objectiveId={goal.id}
              busy={busy}
              onSave={(values) =>
                run(async () => {
                  const kr = await trpc.goals.saveKeyResult.mutate({
                    objectiveId: goal.id,
                    ...values,
                  });

                  if (values.keys.length) {
                    await trpc.goals.linkTasks.mutate({
                      keyResultId: kr.id,
                      keys: values.keys,
                    });
                  }
                }, "Key result added")
              }
            />
          ) : null}
        </section>
      ))}
    </div>
  );
}

function KeyResultForm({
  objectiveId,
  busy,
  onSave,
}: {
  objectiveId: string;
  busy: boolean;
  onSave: (values: {
    title: string;
    kind: "metric" | "tasks";
    startValue: number;
    targetValue: number;
    currentValue: number;
    keys: string[];
  }) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<"metric" | "tasks">("metric");
  const [start, setStart] = useState("0");
  const [target, setTarget] = useState("100");
  const [keys, setKeys] = useState("");

  return (
    <form
      className="flex flex-wrap items-center gap-2 text-sm"
      onSubmit={(event) => {
        event.preventDefault();
        void onSave({
          title,
          kind,
          startValue: Number(start) || 0,
          targetValue: Number(target) || 0,
          currentValue: Number(start) || 0,
          keys:
            kind === "tasks"
              ? keys
                  .split(/[\s,]+/)
                  .map((k) => k.trim())
                  .filter(Boolean)
              : [],
        }).then(() => setTitle(""));
      }}
    >
      <Input
        aria-label="Key result title"
        data-objective={objectiveId}
        placeholder="Key result"
        maxLength={160}
        className="min-w-40 flex-1"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <select
        aria-label="Key result type"
        className="rounded-md border border-line bg-surface px-2 py-1"
        value={kind}
        onChange={(e) => setKind(e.target.value as "metric" | "tasks")}
      >
        <option value="metric">Number</option>
        <option value="tasks">Tasks</option>
      </select>
      {kind === "metric" ? (
        <>
          <Input
            aria-label="Start value"
            type="number"
            className="w-24"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
          <Input
            aria-label="Target value"
            type="number"
            className="w-24"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          />
        </>
      ) : (
        <Input
          aria-label="Task keys"
          placeholder="Task keys, e.g. APP-1 APP-2"
          className="w-56"
          value={keys}
          onChange={(e) => setKeys(e.target.value)}
        />
      )}
      <Button type="submit" size="sm" disabled={busy || !title.trim()}>
        Add key result
      </Button>
    </form>
  );
}
