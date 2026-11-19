"use client";

import Link from "next/link";
import { useState } from "react";

import { useTrpcClient } from "@zentro/api/react";
import { toastError, toastSuccess } from "@zentro/ui/index";
import { Button } from "@zentro/ui/shadcn/button";

import { useAsyncData } from "~/src/lib/use-async-data";

/** Deleted tasks the person could bring back, newest first. */
export function TaskTrash() {
  const trpc = useTrpcClient();
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const trash = useAsyncData(() => trpc.task.trash.query(), [trpc, version]);

  async function restore(key: string) {
    setBusy(key);

    try {
      await trpc.task.restoreByKey.mutate({ key });
      toastSuccess(`${key} restored`);
      setVersion((value) => value + 1);
    } catch (error) {
      toastError(error, "Could not restore the task.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-6">
      <div className="flex items-baseline justify-between gap-2">
        <h1 className="text-xl font-semibold text-ink">Deleted tasks</h1>
        <Link href="/tasks" className="text-sm text-ink-2 hover:underline">
          Back to tasks
        </Link>
      </div>

      {trash.error ? (
        <p role="alert" className="text-sm text-danger">
          The deleted tasks did not load.{" "}
          <button
            type="button"
            className="underline"
            onClick={() => setVersion((value) => value + 1)}
          >
            Retry
          </button>
        </p>
      ) : null}

      {trash.data && trash.data.length === 0 ? (
        <p className="text-sm text-ink-2">
          Nothing here. Tasks you delete, and could delete, show up here so you
          can bring them back.
        </p>
      ) : null}

      {!trash.data && !trash.error ? (
        <p role="status" className="text-sm text-ink-2">
          Loading deleted tasks…
        </p>
      ) : null}

      {trash.data?.length ? (
        <ul className="flex flex-col divide-y divide-hairline rounded-xl border border-hairline">
          {trash.data.map((task) => (
            <li key={task.key} className="flex items-center gap-3 px-4 py-3">
              <span className="font-mono text-xs text-ink-3">{task.key}</span>
              <span className="min-w-0 flex-1 truncate text-sm text-ink">
                {task.name}
              </span>
              <span className="hidden text-xs text-ink-3 sm:inline">
                {task.projectName}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={busy !== null}
                aria-label={`Restore ${task.key}`}
                onClick={() => void restore(task.key)}
              >
                {busy === task.key ? "Restoring…" : "Restore"}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
