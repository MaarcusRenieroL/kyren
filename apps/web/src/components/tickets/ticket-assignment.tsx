"use client";

import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@kyren/ui/shadcn/collapsible";
import { FieldSet, FieldLegend } from "@kyren/ui/shadcn/field";
import { Label } from "@kyren/ui/shadcn/label";
import { Checkbox } from "@kyren/ui/shadcn/checkbox";
import { RadioGroup, RadioGroupItem } from "@kyren/ui/shadcn/radio-group";
import { useCallback, useEffect, useState } from "react";

import { useTrpcClient } from "@kyren/api/react";
import { toastError, toastSuccess } from "@kyren/ui/index";
import { Button } from "@kyren/ui/shadcn/button";

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
    <Collapsible
      role="group"
      className="rounded-xl border border-line px-4 py-3"
    >
      <CollapsibleTrigger className="w-full text-left before:mr-2 before:inline-block before:content-['▸'] data-[state=open]:before:rotate-90 cursor-pointer text-sm font-medium text-ink">
        Automatic assignment {enabled ? "· on" : "· off"}
      </CollapsibleTrigger>
      <CollapsibleContent forceMount className="data-[state=closed]:hidden">
        <p className="mt-2 text-sm text-ink-2">
          New tickets from email and forms go to the people below. Anyone away
          today is skipped. Tickets your team creates by hand keep the assignee
          you pick.
        </p>
        {failed ? (
          <p role="alert" className="mt-2 text-sm text-danger">
            The assignment settings did not load.{" "}
            <Button
              variant="custom"
              type="button"
              className="underline"
              onClick={() => void load()}
            >
              Retry
            </Button>
          </p>
        ) : null}
        <FieldSet
          className="flex-row mt-3 flex flex-wrap gap-x-4 gap-y-2"
          disabled={!loaded}
        >
          <FieldLegend className="sr-only">People who take turns</FieldLegend>
          {people.map((person) => (
            <Label key={person.id} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={chosen.includes(person.id)}
                onCheckedChange={() => toggle(person.id)}
              />
              {person.name}
              {person.awayUntil !== null ? (
                <span className="text-xs text-ink-3">(away)</span>
              ) : null}
            </Label>
          ))}
        </FieldSet>
        <FieldSet
          className="flex-row mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm"
          disabled={!loaded}
        >
          <FieldLegend className="mb-1 text-ink-2" id="assignment-mode-label">
            Who gets the next ticket
          </FieldLegend>
          <RadioGroup
            aria-labelledby="assignment-mode-label"
            name="assignment-mode"
            disabled={!loaded}
            value={mode}
            onValueChange={(value) => {
              if (value === "round_robin" || value === "least_open")
                setMode(value);
            }}
            className="flex flex-wrap gap-4"
          >
            <Label className="flex items-center gap-2">
              <RadioGroupItem value="round_robin" />
              Take turns
            </Label>
            <Label className="flex items-center gap-2">
              <RadioGroupItem value="least_open" />
              Whoever has the fewest open tickets
            </Label>
          </RadioGroup>
        </FieldSet>
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
      </CollapsibleContent>
    </Collapsible>
  );
}
