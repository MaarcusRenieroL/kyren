import type { FC } from "react";
import {
  AlertTriangleIcon,
  FlameIcon,
  GitCommitIcon,
  ShieldAlertIcon,
} from "lucide-react";
import { cn } from "@kyren/ui/lib/utils";
import type { GraphData } from "./types";

type MetricsCardsProps = {
  metrics: GraphData["metrics"];
};

export const MetricsCards: FC<MetricsCardsProps> = ({ metrics }) => {
  return (
    <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
      <div className="flex flex-col gap-1 rounded-2xl border border-hairline/80 bg-surface/80 p-4 shadow-2xs transition-all hover:border-hairline hover:shadow-xs">
        <div className="flex items-center justify-between text-xs text-ink-3">
          <span className="font-medium">Critical Path</span>
          <div className="flex size-7 items-center justify-center rounded-lg bg-signal/10 text-signal">
            <FlameIcon className="size-3.5" />
          </div>
        </div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="font-mono text-2xl font-bold tracking-tight text-ink">
            {metrics.criticalPathLength}
          </span>
          <span className="text-xs text-ink-3">tasks chained</span>
        </div>
        <p className="mt-0.5 text-[11px] text-ink-3">
          Longest bottleneck path determining launch date
        </p>
      </div>

      <div className="flex flex-col gap-1 rounded-2xl border border-hairline/80 bg-surface/80 p-4 shadow-2xs transition-all hover:border-hairline hover:shadow-xs">
        <div className="flex items-center justify-between text-xs text-ink-3">
          <span className="font-medium">Dependencies</span>
          <div className="flex size-7 items-center justify-center rounded-lg bg-muted/60 text-ink-3">
            <GitCommitIcon className="size-3.5" />
          </div>
        </div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="font-mono text-2xl font-bold tracking-tight text-ink">
            {metrics.totalDependencies}
          </span>
          <span className="text-xs text-ink-3">blocker links</span>
        </div>
        <p className="mt-0.5 text-[11px] text-ink-3">
          {metrics.blockedTasksCount} tasks currently waiting
        </p>
      </div>

      <div className="flex flex-col gap-1 rounded-2xl border border-hairline/80 bg-surface/80 p-4 shadow-2xs transition-all hover:border-hairline hover:shadow-xs">
        <div className="flex items-center justify-between text-xs text-ink-3">
          <span className="font-medium">Bottlenecks</span>
          <div className="flex size-7 items-center justify-center rounded-lg bg-warning-subtle text-warning-text">
            <AlertTriangleIcon className="size-3.5" />
          </div>
        </div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="font-mono text-2xl font-bold tracking-tight text-ink">
            {metrics.bottlenecksCount}
          </span>
          <span className="text-xs text-ink-3">high blast radius</span>
        </div>
        <p className="mt-0.5 text-[11px] text-ink-3">
          Tasks blocking multiple downstream work items
        </p>
      </div>

      <div className="flex flex-col gap-1 rounded-2xl border border-hairline/80 bg-surface/80 p-4 shadow-2xs transition-all hover:border-hairline hover:shadow-xs">
        <div className="flex items-center justify-between text-xs text-ink-3">
          <span className="font-medium">Project Risk</span>
          <div
            className={cn(
              "flex size-7 items-center justify-center rounded-lg",
              metrics.riskLevel === "high"
                ? "bg-danger-subtle text-danger-text"
                : metrics.riskLevel === "moderate"
                  ? "bg-warning-subtle text-warning-text"
                  : "bg-success-subtle text-success-text",
            )}
          >
            <ShieldAlertIcon className="size-3.5" />
          </div>
        </div>
        <div className="mt-1 flex items-baseline gap-2">
          <span
            className={cn(
              "font-mono text-2xl font-bold tracking-tight uppercase",
              metrics.riskLevel === "high"
                ? "text-danger-text"
                : metrics.riskLevel === "moderate"
                  ? "text-warning-text"
                  : "text-success-text",
            )}
          >
            {metrics.riskLevel}
          </span>
        </div>
        <p className="mt-0.5 text-[11px] text-ink-3">
          {metrics.riskLevel === "high"
            ? "Overdue or heavy blocker chain detected"
            : metrics.riskLevel === "moderate"
              ? "Active dependency bottlenecks exist"
              : "Smooth schedule with minimal bottlenecks"}
        </p>
      </div>
    </div>
  );
};
