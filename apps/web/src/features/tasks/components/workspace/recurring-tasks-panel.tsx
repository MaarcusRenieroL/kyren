"use client";

import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@kyren/ui/shadcn/collapsible";
import { useState } from "react";

import { useTrpcClient } from "@kyren/api/react";
import { toastError, toastSuccess } from "@kyren/ui/index";
import { Button } from "@kyren/ui/shadcn/button";
import { Input } from "@kyren/ui/shadcn/input";
import { NativeSelect } from "@kyren/ui/shadcn/native-select";

import { useAsyncData } from "~/src/lib/use-async-data";
import { getDateInputValue } from "../task-detail/task-detail-utils";

const cadenceWords = {
  daily: "Every day",
  weekly: "Every week",
  monthly: "Every month",
};

/** Tasks that come back on a schedule, for one project. */
export function RecurringTasksPanel({ projectId }: { projectId: string }) {
  const trpc = useTrpcClient();
  const [version, setVersion] = useState(0);
  const rules = useAsyncData(
    () => trpc.recurrence.list.query({ projectId }),
    [trpc, projectId, version],
  );
  const [name, setName] = useState("");
  const [cadence, setCadence] = useState<"daily" | "weekly" | "monthly">(
    "weekly",
  );
  const [startsOn, setStartsOn] = useState(() => getDateInputValue(new Date()));
  const [busy, setBusy] = useState(false);

  async function run(work: () => Promise<unknown>, done: string) {
    setBusy(true);

    try {
      await work();
      toastSuccess(done);
      setVersion((v) => v + 1);
    } catch (error) {
      toastError(error, "Could not change the repeating task.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Collapsible
      role="group"
      className="rounded-xl border border-line px-4 py-3"
    >
      <CollapsibleTrigger className="w-full text-left before:mr-2 before:inline-block before:content-['▸'] data-[state=open]:before:rotate-90 cursor-pointer text-sm font-medium text-ink">
        Repeating tasks
      </CollapsibleTrigger>
      <CollapsibleContent forceMount className="data-[state=closed]:hidden">
        <ul className="mt-3 flex flex-col gap-1 text-sm">
          {(rules.data ?? []).map((rule) => (
            <li key={rule.id} className="flex items-center gap-2">
              <span className="flex-1 truncate text-ink">{rule.name}</span>
              <span className="text-xs text-ink-2">
                {cadenceWords[rule.cadence as keyof typeof cadenceWords]}
                {rule.enabled ? "" : " · paused"}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() =>
                  void run(
                    () =>
                      trpc.recurrence.setEnabled.mutate({
                        projectId,
                        id: rule.id,
                        enabled: !rule.enabled,
                      }),
                    rule.enabled ? "Paused" : "Resumed",
                  )
                }
              >
                {rule.enabled ? "Pause" : "Resume"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() =>
                  void run(
                    () =>
                      trpc.recurrence.remove.mutate({ projectId, id: rule.id }),
                    "Removed",
                  )
                }
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
        <form
          className="mt-3 flex flex-wrap items-center gap-2 text-sm"
          onSubmit={(event) => {
            event.preventDefault();
            void run(async () => {
              await trpc.recurrence.create.mutate({
                projectId,
                name,
                cadence,
                startsOn,
              });
              setName("");
            }, "Repeating task added");
          }}
        >
          <Input
            aria-label="Repeating task name"
            placeholder="Task name"
            maxLength={120}
            className="w-56"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <NativeSelect
            aria-label="Repeats"
            size="sm"
            className="w-36"
            value={cadence}
            onChange={(e) => setCadence(e.target.value as "daily")}
          >
            <option value="daily">Every day</option>
            <option value="weekly">Every week</option>
            <option value="monthly">Every month</option>
          </NativeSelect>
          <Input
            aria-label="First task on"
            type="date"
            className="w-40"
            value={startsOn}
            onChange={(e) => setStartsOn(e.target.value)}
          />
          <Button type="submit" size="sm" disabled={busy || !name.trim()}>
            Add repeating task
          </Button>
        </form>
      </CollapsibleContent>
    </Collapsible>
  );
}
