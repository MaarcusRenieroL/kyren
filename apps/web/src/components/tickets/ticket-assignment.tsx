"use client";

import { useCallback, useEffect, useState } from "react";

import { useTrpcClient } from "@zentro/api/react";
import { toastError, toastSuccess } from "@zentro/ui/index";
import { Button } from "@zentro/ui/shadcn/button";

type Person = { id: string; name: string; awayUntil: string | null };
type Mode = "round_robin" | "least_open";

/** Who new tickets from email and forms go to: in turn, or the least busy. */
export function TicketAssignment() {
  const trpc = useTrpcClient();
  const [people, setPeople] = useState<Person[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [chosen, setChosen] = useState<string[]>([]);
  const [mode, setMode] = useState<Mode>("round_robin");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const [rule, everyone] = await Promise.all([
        trpc.tickets.assignmentRule.query(),
        trpc.tickets.assignees.query(),
      ]);

      setEnabled(rule.enabled);
      setMode(rule.mode);
      // Someone who has left can't be seen here, so they can't stay ticked.
      setChosen(
        rule.memberIds.filter((id) =>
          everyone.some((person) => person.id === id),
        ),
      );
      setPeople(everyone);
      setLoaded(true);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [trpc]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(next: { enabled: boolean; memberIds: string[] }) {
    setBusy(true);

    try {
      const saved = await trpc.tickets.setAssignmentRule.mutate({
        ...next,
        mode,
      });

      setEnabled(saved.enabled);
      setChosen(saved.memberIds);
      setMode(saved.mode);
      toastSuccess("Saved");
    } catch (error) {
      toastError(error, "Could not change automatic assignment.");
    } finally {
      setBusy(false);
    }
  }

  const toggle = (id: string) =>
    setChosen((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );

  return (
    <details className="rounded-xl border border-line px-4 py-3">
      <summary className="cursor-pointer text-sm font-medium text-ink">
        Automatic assignment {enabled ? "· on" : "· off"}
      </summary>
      <p className="mt-2 text-sm text-ink-2">
        New tickets from email and forms go to the people below. Anyone away
        today is skipped. Tickets your team creates by hand keep the assignee
        you pick.
      </p>
      {failed ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          The assignment settings did not load.{" "}
          <button
            type="button"
            className="underline"
            onClick={() => void load()}
          >
            Retry
          </button>
        </p>
      ) : null}
      <fieldset
        className="mt-3 flex flex-wrap gap-x-4 gap-y-2"
        disabled={!loaded}
      >
        <legend className="sr-only">People who take turns</legend>
        {people.map((person) => (
          <label key={person.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={chosen.includes(person.id)}
              onChange={() => toggle(person.id)}
            />
            {person.name}
            {person.awayUntil !== null ? (
              <span className="text-xs text-ink-3">(away)</span>
            ) : null}
          </label>
        ))}
      </fieldset>
      <fieldset
        className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm"
        disabled={!loaded}
      >
        <legend className="mb-1 text-ink-2">Who gets the next ticket</legend>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="assignment-mode"
            checked={mode === "round_robin"}
            onChange={() => setMode("round_robin")}
          />
          Take turns
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="assignment-mode"
            checked={mode === "least_open"}
            onChange={() => setMode("least_open")}
          />
          Whoever has the fewest open tickets
        </label>
      </fieldset>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={busy || !loaded || !chosen.length}
          onClick={() => void save({ enabled: true, memberIds: chosen })}
        >
          {enabled ? "Save rotation" : "Turn on"}
        </Button>
        {enabled ? (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => void save({ enabled: false, memberIds: chosen })}
          >
            Turn off
          </Button>
        ) : null}
      </div>
    </details>
  );
}
