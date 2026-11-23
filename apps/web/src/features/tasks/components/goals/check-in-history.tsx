"use client";

import { Button } from "@zentro/ui/shadcn/button";
import { useState } from "react";
import { useTrpcClient } from "@zentro/api/react";
import { useAsyncData } from "~/src/lib/use-async-data";

import { ConfidenceBadge, when } from "./goal-types";

/** Past check-ins on a key result, loaded when someone opens them. */
export function CheckInHistory({
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
      <Button
        variant="custom"
        type="button"
        className="text-xs text-ink-2 underline"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? "Hide check-ins" : `Check-ins for ${title}`}
      </Button>
      {open ? (
        <CheckInList keyResultId={keyResultId} unit={unit} version={version} />
      ) : null}
    </div>
  );
}

export function CheckInList({
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
