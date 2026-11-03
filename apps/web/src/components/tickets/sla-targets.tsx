"use client";

import { useCallback, useEffect, useState } from "react";

import { useTrpcClient } from "@zentro/api/react";
import { toastError, toastSuccess } from "@zentro/ui/index";
import { Button } from "@zentro/ui/shadcn/button";
import { Input } from "@zentro/ui/shadcn/input";

import { priorityLabels } from "./labels";

const priorities = ["urgent", "high", "normal", "low"] as const;

type Row = { response: string; resolution: string };

const toHours = (minutes: number | null) =>
  minutes === null ? "" : String(Math.round((minutes / 60) * 100) / 100);

const toMinutes = (hours: string) => {
  const value = Number.parseFloat(hours);

  return Number.isFinite(value) && value > 0 ? Math.round(value * 60) : null;
};

/** For people who manage tickets: how fast each priority must be answered and resolved. */
export function SlaTargets() {
  const trpc = useTrpcClient();
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const policies = await trpc.tickets.slaPolicy.query();

      setRows(
        Object.fromEntries(
          policies.map((policy) => [
            policy.priority,
            {
              response: toHours(policy.firstResponseMinutes),
              resolution: toHours(policy.resolutionMinutes),
            },
          ]),
        ),
      );
    } catch {
      // Targets are optional; the queue works without them.
    }
  }, [trpc]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(priority: (typeof priorities)[number]) {
    const row = rows[priority] ?? { response: "", resolution: "" };

    setBusy(priority);

    try {
      await trpc.tickets.setSla.mutate({
        priority,
        firstResponseMinutes: toMinutes(row.response),
        resolutionMinutes: toMinutes(row.resolution),
      });
      toastSuccess(`${priorityLabels[priority]} targets saved`);
      await load();
    } catch (error) {
      toastError(error, "Could not save the targets.");
    } finally {
      setBusy(null);
    }
  }

  const set = (priority: string, key: keyof Row, value: string) =>
    setRows((current) => ({
      ...current,
      [priority]: {
        response: "",
        resolution: "",
        ...current[priority],
        [key]: value,
      },
    }));

  return (
    <details className="rounded-xl border border-line px-4 py-3">
      <summary className="cursor-pointer text-sm font-medium text-ink">
        Response targets
      </summary>
      <p className="mt-2 text-sm text-ink-2">
        Hours from when a ticket arrives. Leave a box empty for no target.
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {priorities.map((priority) => (
          <li key={priority} className="flex flex-wrap items-end gap-2">
            <span className="w-20 pb-2 text-sm text-ink">
              {priorityLabels[priority]}
            </span>
            <label className="flex flex-col gap-1 text-xs text-ink-3">
              First answer
              <Input
                type="number"
                min="0"
                step="any"
                className="h-9 w-28"
                aria-label={`${priorityLabels[priority]} first answer, hours`}
                value={rows[priority]?.response ?? ""}
                onChange={(event) =>
                  set(priority, "response", event.target.value)
                }
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-ink-3">
              Resolved
              <Input
                type="number"
                min="0"
                step="any"
                className="h-9 w-28"
                aria-label={`${priorityLabels[priority]} resolved, hours`}
                value={rows[priority]?.resolution ?? ""}
                onChange={(event) =>
                  set(priority, "resolution", event.target.value)
                }
              />
            </label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy === priority}
              aria-label={`Save ${priorityLabels[priority]} targets`}
              onClick={() => void save(priority)}
            >
              Save
            </Button>
          </li>
        ))}
      </ul>
    </details>
  );
}
