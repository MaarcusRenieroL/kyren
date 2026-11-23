"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PlusIcon } from "lucide-react";

import { useTrpcClient } from "@zentro/api/react";
import { EmptyState } from "@zentro/ui/components/empty-state";
import { Button } from "@zentro/ui/shadcn/button";
import { Dialog, DialogContent } from "@zentro/ui/shadcn/dialog";

import { formatMoney, formatPeriod, runTone } from "../money";
import { NewRunDialog } from "./new-run-dialog";
import { OffCycleForm } from "./off-cycle-form";
import type { Runs } from "./payroll-types";

export function RunsTab() {
  const trpc = useTrpcClient();
  const router = useRouter();
  const [runs, setRuns] = useState<Runs | null>(null);
  const [failed, setFailed] = useState(false);
  const [creating, setCreating] = useState(false);
  const [offCycle, setOffCycle] = useState(false);

  const load = useCallback(async () => {
    try {
      setRuns(await trpc.payroll.runs.query());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [trpc]);

  useEffect(() => {
    void load();
  }, [load]);

  const button = runs?.canManage ? (
    <div className="flex gap-2">
      <Button variant="outline" onClick={() => setOffCycle(true)}>
        Off-cycle run
      </Button>
      <Button onClick={() => setCreating(true)}>
        <PlusIcon aria-hidden />
        New pay run
      </Button>
    </div>
  ) : null;

  if (failed)
    return (
      <EmptyState
        title="Pay runs did not load"
        description="Check your connection and try again."
        action={<Button onClick={() => void load()}>Retry</Button>}
      />
    );

  if (!runs)
    return (
      <p role="status" className="text-sm text-ink-2">
        Loading pay runs…
      </p>
    );

  return (
    <>
      {button ? <div className="flex justify-end">{button}</div> : null}
      {runs.runs.length === 0 ? (
        <EmptyState
          title="No pay runs yet"
          description="Set salaries first, then start a run for a period."
        />
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {runs.runs.map((run) => (
            <li key={run.id}>
              <Link
                href={`/payroll/${run.id}`}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 outline-none hover:bg-sunken focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="min-w-0 flex-[1_1_14rem]">
                  <span className="block truncate font-medium text-ink">
                    {run.label}
                  </span>
                  <span className="text-sm text-ink-2">
                    {formatPeriod(run.periodStart, run.periodEnd)} ·{" "}
                    {run.people} {run.people === 1 ? "person" : "people"}
                  </span>
                </span>
                <span className="font-mono text-sm text-ink">
                  {formatMoney(run.net, run.currency)}
                </span>
                {run.kind === "off_cycle" ? (
                  <span className="rounded-full border border-line px-2 py-0.5 text-xs text-ink-2">
                    Off-cycle
                  </span>
                ) : null}
                <span
                  className={`rounded-full px-2 py-0.5 text-xs capitalize ${runTone[run.status]}`}
                >
                  {run.status}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <NewRunDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(id) => router.push(`/payroll/${id}`)}
      />
      <Dialog
        open={offCycle}
        onOpenChange={(next) => !next && setOffCycle(false)}
      >
        <DialogContent>
          {offCycle ? (
            <OffCycleForm
              onClose={() => setOffCycle(false)}
              onCreated={(id) => router.push(`/payroll/${id}`)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
