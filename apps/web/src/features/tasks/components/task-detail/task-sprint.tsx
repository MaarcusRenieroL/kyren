"use client";

import { Label } from "@kyren/ui/shadcn/label";
import { useTrpcClient } from "@kyren/api/react";
import { toastError } from "@kyren/ui/index";
import { NativeSelect } from "@kyren/ui/shadcn/native-select";

import { useAsyncData } from "~/src/lib/use-async-data";

/** Which sprint a task is planned in, changeable in place. */
export function TaskSprint({
  taskKey,
  projectId,
  sprintId,
  canEdit,
}: {
  taskKey: string;
  projectId: string;
  sprintId: string | null;
  canEdit: boolean;
}) {
  const trpc = useTrpcClient();
  const sprints = useAsyncData(
    () => trpc.sprint.list.query({ projectId }),
    [trpc, projectId],
  );
  const open = (sprints.data ?? []).filter((s) => s.status !== "completed");
  const current = (sprints.data ?? []).find((s) => s.id === sprintId);

  if (!sprints.data || (!open.length && !current)) return null;

  return (
    <section aria-label="Sprint" className="tile px-[22px] py-[18px]">
      <Label className="flex items-center justify-between gap-3 text-sm">
        <span className="font-semibold text-ink">Sprint</span>
        <NativeSelect
          className="w-48"
          disabled={!canEdit}
          value={sprintId ?? ""}
          onChange={(event) => {
            trpc.sprint.assign
              .mutate({
                projectId,
                sprintId: event.target.value || null,
                keys: [taskKey],
              })
              .then(() => sprints.reload())
              .catch((error: unknown) =>
                toastError(error, "Could not change the sprint."),
              );
          }}
        >
          <option value="">Not planned</option>
          {current && current.status === "completed" ? (
            <option value={current.id}>{current.name} (completed)</option>
          ) : null}
          {open.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.status === "active" ? " (running)" : ""}
            </option>
          ))}
        </NativeSelect>
      </Label>
    </section>
  );
}
