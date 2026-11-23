"use client";

import { useState } from "react";
import { useTrpcClient } from "@zentro/api/react";
import { toastError, toastSuccess } from "@zentro/ui/index";
import { Button } from "@zentro/ui/shadcn/button";
import { Input } from "@zentro/ui/shadcn/input";

import { useAsyncData } from "~/src/lib/use-async-data";
import { CheckInForm } from "./check-in-form";
import { CheckInHistory } from "./check-in-history";
import { GoalHeader } from "./goal-header";
import {
  Bar,
  ConfidenceBadge,
  percent,
} from "./goal-types";
import { KeyResultForm } from "./key-result-form";

export { ConfidenceBadge } from "./goal-types";

/** Goals for a period, each measured by key results. */
export function Goals({ canManage }: { canManage: boolean }) {
  const trpc = useTrpcClient();
  const [version, setVersion] = useState(0);
  const goals = useAsyncData(() => trpc.goals.list.query(), [trpc, version]);
  const [title, setTitle] = useState("");
  const [period, setPeriod] = useState("");
  const [busy, setBusy] = useState(false);

  /** Runs a change and says whether it worked. */
  async function run(work: () => Promise<unknown>, done: string) {
    setBusy(true);

    try {
      await work();
      toastSuccess(done);
      setVersion((v) => v + 1);

      return true;
    } catch (error) {
      toastError(error, "Could not change the goal.");

      return false;
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
            className="w-44"
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
          <GoalHeader
            goal={goal}
            canManage={canManage}
            busy={busy}
            onSave={(changes, done) =>
              run(
                () =>
                  trpc.goals.saveObjective.mutate({
                    id: goal.id,
                    title: goal.title,
                    description: goal.description,
                    period: goal.period,
                    status: goal.status as "active" | "closed",
                    ownerMemberId: goal.ownerMemberId,
                    ...changes,
                  }),
                done,
              )
            }
            onDelete={() =>
              void run(
                () => trpc.goals.removeObjective.mutate({ id: goal.id }),
                "Goal deleted",
              )
            }
          />
          <Bar value={goal.progress} label={`${goal.title} progress`} />

          <ul className="flex flex-col gap-3">
            {goal.keyResults.map((kr) => (
              <li key={kr.id} className="flex flex-col gap-1 text-sm">
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 text-ink">{kr.title}</span>
                  {kr.confidence ? (
                    <ConfidenceBadge value={kr.confidence} />
                  ) : null}
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
                {kr.kind === "metric" ? (
                  <CheckInHistory
                    keyResultId={kr.id}
                    title={kr.title}
                    unit={kr.unit}
                    version={version}
                  />
                ) : null}
                {kr.canUpdate || canManage ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {kr.canUpdate ? (
                      <CheckInForm
                        title={kr.title}
                        value={kr.currentValue}
                        confidence={kr.confidence ?? "on_track"}
                        busy={busy}
                        onSave={(values) =>
                          run(
                            () =>
                              trpc.goals.updateValue.mutate({
                                keyResultId: kr.id,
                                ...values,
                              }),
                            "Check-in saved",
                          )
                        }
                      />
                    ) : null}
                    {canManage ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        aria-label={`Remove key result ${kr.title}`}
                        onClick={() => {
                          if (
                            !window.confirm(
                              `Remove the key result "${kr.title}"?`,
                            )
                          ) {
                            return;
                          }

                          void run(
                            () =>
                              trpc.goals.removeKeyResult.mutate({ id: kr.id }),
                            "Key result removed",
                          );
                        }}
                      >
                        Remove
                      </Button>
                    ) : null}
                  </div>
                ) : null}
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
