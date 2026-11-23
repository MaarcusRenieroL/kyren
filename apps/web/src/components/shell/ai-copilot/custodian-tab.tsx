"use client";

import { useState, type FC } from "react";
import { useTrpcClient } from "@zentro/api/react";
import { Button } from "@zentro/ui/shadcn/button";
import { TabsContent } from "@zentro/ui/shadcn/tabs";
import { toastSuccess, toastError } from "@zentro/ui/index";
import type { SweepResult } from "./types";

export const CustodianTab: FC = () => {
  const trpc = useTrpcClient();
  const [sweepResult, setSweepResult] = useState<SweepResult | null>(null);
  const [sweepLoading, setSweepLoading] = useState(false);

  async function handleRunSweep() {
    setSweepLoading(true);
    try {
      const res = await trpc.custodian.runSweep.mutate({ dryRun: false });
      setSweepResult(res);
      toastSuccess(
        `Custodian sweep completed: ${res.staleTasksCount} stale tasks, ${res.linksCreated} doc links.`,
      );
    } catch (err) {
      toastError(err, "Custodian sweep failed.");
    } finally {
      setSweepLoading(false);
    }
  }

  return (
    <TabsContent
      value="custodian"
      className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 m-0"
    >
      <div className="flex flex-col gap-2 rounded-lg border border-hairline p-3.5">
        <span className="text-xs font-semibold text-ink">
          Workspace upkeep
        </span>
        <p className="text-xs text-ink-3 leading-relaxed">
          Flags tasks untouched for 14 days and open tickets older than a day,
          and links docs to the task keys they mention.
        </p>
        <Button
          size="sm"
          onClick={handleRunSweep}
          disabled={sweepLoading}
          className="mt-1"
        >
          {sweepLoading ? "Running Sweep..." : "Run Workspace Maintenance"}
        </Button>
      </div>

      {sweepResult ? (
        <div className="flex flex-col gap-2.5 rounded-lg border border-hairline p-3 text-xs">
          <span className="font-semibold text-ink">Sweep Summary</span>
          <div className="flex justify-between border-b border-hairline py-1">
            <span className="text-ink-3">Stale Tasks Flagged:</span>
            <span className="font-mono font-medium">
              {sweepResult.staleTasksCount}
            </span>
          </div>
          <div className="flex justify-between border-b border-hairline py-1">
            <span className="text-ink-3">Doc-to-Task Links Created:</span>
            <span className="font-mono font-medium">
              {sweepResult.linksCreated}
            </span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-ink-3">SLA Breach Warnings:</span>
            <span className="font-mono font-medium">
              {sweepResult.slaRiskCount}
            </span>
          </div>
        </div>
      ) : null}
    </TabsContent>
  );
};
