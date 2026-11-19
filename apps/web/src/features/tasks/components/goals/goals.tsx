"use client";

import { useState } from "react";

import { useTrpcClient } from "@zentro/api/react";
import { toastError, toastSuccess } from "@zentro/ui/index";
import { Button } from "@zentro/ui/shadcn/button";
import { Input } from "@zentro/ui/shadcn/input";
import { NativeSelect } from "@zentro/ui/shadcn/native-select";

import { useAsyncData } from "~/src/lib/use-async-data";

const percent = (value: number) => `${Math.round(value * 100)}%`;

type Confidence = "on_track" | "at_risk" | "off_track";

const confidenceLabel: Record<Confidence, string> = {
  on_track: "On track",
  at_risk: "At risk",
  off_track: "Off track",
};

const confidenceTone: Record<Confidence, string> = {
  on_track: "bg-success-subtle text-success-text",
  at_risk: "bg-warning-subtle text-warning-text",
  off_track: "bg-danger-subtle text-danger-text",
};

function ConfidenceBadge({ value }: { value: Confidence }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${confidenceTone[value]}`}
    >
      {confidenceLabel[value]}
    </span>
  );
}

const when = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

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
  }) => Promise<unknown>;
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
      <NativeSelect
        aria-label="Key result type"
        size="sm"
        className="w-28"
        value={kind}
        onChange={(e) => setKind(e.target.value as "metric" | "tasks")}
      >
        <option value="metric">Number</option>
        <option value="tasks">Tasks</option>
      </NativeSelect>
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

/** Moves a metric key result to its latest number. */
function CheckInForm({
  title,
  value,
  confidence,
  busy,
  onSave,
}: {
  title: string;
  value: number;
  confidence: Confidence;
  busy: boolean;
  onSave: (values: {
    currentValue: number;
    confidence: Confidence;
    note?: string;
  }) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState(String(value));
  const [level, setLevel] = useState<Confidence>(confidence);
  const [note, setNote] = useState("");
  const parsed = Number(draft);
  const valid = draft.trim() !== "" && Number.isFinite(parsed);
  const changed =
    parsed !== value || level !== confidence || note.trim() !== "";

  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();

        if (!valid) return;

        void onSave({
          currentValue: parsed,
          confidence: level,
          note: note.trim() || undefined,
        }).then((saved) => {
          if (saved) setNote("");
        });
      }}
    >
      <Input
        type="number"
        step="any"
        className="h-8 w-28"
        aria-label={`Current value for ${title}`}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
      <NativeSelect
        className="h-8"
        aria-label={`Confidence for ${title}`}
        value={level}
        onChange={(event) => setLevel(event.target.value as Confidence)}
      >
        {(Object.keys(confidenceLabel) as Confidence[]).map((key) => (
          <option key={key} value={key}>
            {confidenceLabel[key]}
          </option>
        ))}
      </NativeSelect>
      <Input
        className="h-8 min-w-52 flex-1"
        maxLength={1000}
        placeholder="What changed? (optional)"
        aria-label={`Check-in note for ${title}`}
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />
      <Button
        type="submit"
        size="sm"
        variant="outline"
        disabled={busy || !valid || !changed}
      >
        Check in
      </Button>
    </form>
  );
}

/** Past check-ins on a key result, loaded when someone opens them. */
function CheckInHistory({
  keyResultId,
  title,
  unit,
  version,
}: {
  keyResultId: string;
  title: string;
  unit: string | null;
  version: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        className="text-xs text-ink-2 underline"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? "Hide check-ins" : `Check-ins for ${title}`}
      </button>
      {open ? (
        <CheckInList keyResultId={keyResultId} unit={unit} version={version} />
      ) : null}
    </div>
  );
}

function CheckInList({
  keyResultId,
  unit,
  version,
}: {
  keyResultId: string;
  unit: string | null;
  version: number;
}) {
  const trpc = useTrpcClient();
  const history = useAsyncData(
    () => trpc.goals.checkIns.query({ keyResultId }),
    [trpc, keyResultId, version],
  );

  if (history.error) {
    return (
      <p role="alert" className="mt-1 text-xs text-danger-text">
        Could not load the check-ins.
      </p>
    );
  }

  if (!history.data) {
    return <p className="mt-1 text-xs text-ink-3">Loading…</p>;
  }

  if (!history.data.length) {
    return <p className="mt-1 text-xs text-ink-3">No check-ins yet.</p>;
  }

  return (
    <ol className="mt-2 flex flex-col gap-2 border-l border-line pl-3">
      {history.data.map((entry) => (
        <li key={entry.id} className="flex flex-col gap-0.5 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-ink">
              {entry.value}
              {unit ? ` ${unit}` : ""}
            </span>
            <ConfidenceBadge value={entry.confidence} />
            <span className="text-ink-3">
              {entry.by ?? "Former member"} · {when.format(new Date(entry.at))}
            </span>
          </div>
          {entry.note ? <p className="text-ink-2">{entry.note}</p> : null}
        </li>
      ))}
    </ol>
  );
}

/** A goal's title line: rename, close or reopen, and delete. */
function GoalHeader({
  goal,
  canManage,
  busy,
  onSave,
  onDelete,
}: {
  goal: {
    title: string;
    period: string | null;
    status: string;
    progress: number;
  };
  canManage: boolean;
  busy: boolean;
  onSave: (
    changes: { title?: string; status?: "active" | "closed" },
    done: string,
  ) => Promise<boolean>;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(goal.title);
  const closed = goal.status === "closed";

  if (editing) {
    return (
      <form
        className="flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();

          if (!draft.trim()) return;
          // A failed save keeps the editor open with what was typed.
          void onSave({ title: draft.trim() }, "Goal renamed").then((saved) => {
            if (saved) setEditing(false);
          });
        }}
      >
        <Input
          aria-label={`New title for ${goal.title}`}
          maxLength={160}
          className="flex-1"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          autoFocus
        />
        <Button type="submit" size="sm" disabled={busy || !draft.trim()}>
          Save
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            setDraft(goal.title);
            setEditing(false);
          }}
        >
          Cancel
        </Button>
      </form>
    );
  }

  return (
    <div className="flex flex-wrap items-baseline gap-2">
      {/* The title keeps a readable width; the rest wraps below it. */}
      <h2 className="min-w-0 flex-[1_1_14rem] text-base font-medium text-ink">
        {goal.title}
      </h2>
      {closed ? (
        <span className="rounded-full border border-hairline px-2 text-xs text-ink-2">
          Closed
        </span>
      ) : null}
      {goal.period ? (
        <span className="text-xs text-ink-2">{goal.period}</span>
      ) : null}
      <span className="text-sm font-medium text-ink">
        {percent(goal.progress)}
      </span>
      {canManage ? (
        <>
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            aria-label={`Rename goal ${goal.title}`}
            onClick={() => setEditing(true)}
          >
            Rename
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            aria-label={`${closed ? "Reopen" : "Close"} goal ${goal.title}`}
            onClick={() =>
              void onSave(
                { status: closed ? "active" : "closed" },
                closed ? "Goal reopened" : "Goal closed",
              )
            }
          >
            {closed ? "Reopen" : "Close"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            aria-label={`Delete goal ${goal.title}`}
            onClick={onDelete}
          >
            Delete
          </Button>
        </>
      ) : null}
    </div>
  );
}
