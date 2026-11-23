import type { FC } from "react";
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  GaugeIcon,
  ScaleIcon,
} from "lucide-react";
import { cn } from "@kyren/ui/lib/utils";

type WorkloadOverviewBarProps = {
  avgUtilization: number;
  overloadedCount: number;
  underutilizedCount: number;
  openTasksCount: number;
  totalOpenPoints: number;
};

export const WorkloadOverviewBar: FC<WorkloadOverviewBarProps> = ({
  avgUtilization,
  overloadedCount,
  underutilizedCount,
  openTasksCount,
  totalOpenPoints,
}) => {
  return (
    <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
      <div className="flex flex-col gap-1 rounded-2xl border border-hairline/80 bg-surface/80 p-4 shadow-2xs transition-all hover:border-hairline hover:shadow-xs">
        <div className="flex items-center justify-between text-xs text-ink-3">
          <span className="font-medium">Avg Capacity</span>
          <div className="flex size-7 items-center justify-center rounded-lg bg-signal/10 text-signal">
            <GaugeIcon className="size-3.5" />
          </div>
        </div>
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="font-mono text-xl font-bold tracking-tight text-ink">
            {avgUtilization}%
          </span>
          <span className="text-xs text-ink-3">utilized</span>
        </div>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-300",
              avgUtilization > 100
                ? "bg-danger"
                : avgUtilization > 80
                  ? "bg-warning"
                  : "bg-success",
            )}
            style={{ width: `${Math.min(100, avgUtilization)}%` }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1 rounded-2xl border border-hairline/80 bg-surface/80 p-4 shadow-2xs transition-all hover:border-hairline hover:shadow-xs">
        <div className="flex items-center justify-between text-xs text-ink-3">
          <span className="font-medium">Overallocated</span>
          <div className="flex size-7 items-center justify-center rounded-lg bg-danger-subtle text-danger-text">
            <AlertCircleIcon className="size-3.5" />
          </div>
        </div>
        <div className="mt-1 flex items-baseline gap-1.5">
          <span
            className={cn(
              "font-mono text-xl font-bold tracking-tight",
              overloadedCount > 0 ? "text-danger-text" : "text-ink",
            )}
          >
            {overloadedCount}
          </span>
          <span className="text-xs text-ink-3">members</span>
        </div>
        <p className="mt-0.5 text-[11px] text-ink-3">
          {overloadedCount > 0
            ? "Rebalance tasks below"
            : "All within safe limits"}
        </p>
      </div>

      <div className="flex flex-col gap-1 rounded-2xl border border-hairline/80 bg-surface/80 p-4 shadow-2xs transition-all hover:border-hairline hover:shadow-xs">
        <div className="flex items-center justify-between text-xs text-ink-3">
          <span className="font-medium">Available</span>
          <div className="flex size-7 items-center justify-center rounded-lg bg-success-subtle text-success-text">
            <CheckCircle2Icon className="size-3.5" />
          </div>
        </div>
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="font-mono text-xl font-bold tracking-tight text-success-text">
            {underutilizedCount}
          </span>
          <span className="text-xs text-ink-3">can take work</span>
        </div>
        <p className="mt-0.5 text-[11px] text-ink-3">
          Teammates with light backlog
        </p>
      </div>

      <div className="flex flex-col gap-1 rounded-2xl border border-hairline/80 bg-surface/80 p-4 shadow-2xs transition-all hover:border-hairline hover:shadow-xs">
        <div className="flex items-center justify-between text-xs text-ink-3">
          <span className="font-medium">In-Flight Work</span>
          <div className="flex size-7 items-center justify-center rounded-lg bg-muted/60 text-ink-3">
            <ScaleIcon className="size-3.5" />
          </div>
        </div>
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="font-mono text-xl font-bold tracking-tight text-ink">
            {openTasksCount}
          </span>
          <span className="text-xs text-ink-3">
            tasks {totalOpenPoints > 0 ? `(${totalOpenPoints}pts)` : ""}
          </span>
        </div>
        <p className="mt-0.5 text-[11px] text-ink-3">
          Total open tasks across team
        </p>
      </div>
    </div>
  );
};
