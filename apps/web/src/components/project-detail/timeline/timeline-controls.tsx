import { Input } from "@kyren/ui/shadcn/input";
import { Button } from "@kyren/ui/shadcn/button";
import type { Dispatch, FC, SetStateAction } from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  FlameIcon,
  SearchIcon,
} from "lucide-react";
import { cn } from "@kyren/ui/lib/utils";
import type { TimelineScale } from "./types";

type TimelineControlsProps = {
  search: string;
  onSearchChange: (value: string) => void;
  scale: TimelineScale;
  onScaleChange: (scale: TimelineScale) => void;
  highlightCritical: boolean;
  onToggleHighlightCritical: () => void;
  criticalCount: number;
  setOffsetWeeks: Dispatch<SetStateAction<number>>;
};

export const TimelineControls: FC<TimelineControlsProps> = ({
  search,
  onSearchChange,
  scale,
  onScaleChange,
  highlightCritical,
  onToggleHighlightCritical,
  criticalCount,
  setOffsetWeeks,
}) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-hairline/80 bg-surface/70 p-3.5 shadow-2xs backdrop-blur dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]">
      <div className="flex flex-wrap items-center gap-2">
        {/* Search Input */}
        <div className="relative h-8 w-56">
          <SearchIcon className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-ink-3" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search timeline..."
            className="h-full w-full rounded-xl border border-hairline bg-surface pr-2.5 pl-8 text-xs text-ink outline-none placeholder:text-ink-3 focus-visible:border-ring"
          />
        </div>

        {/* Scale Toggle */}
        <div className="flex rounded-xl border border-hairline bg-surface p-0.5">
          <Button
            variant="custom"
            type="button"
            onClick={() => onScaleChange("days")}
            className={cn(
              "rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer",
              scale === "days"
                ? "bg-ink text-ink-inverse"
                : "text-ink-3 hover:text-ink",
            )}
          >
            Days
          </Button>
          <Button
            variant="custom"
            type="button"
            onClick={() => onScaleChange("weeks")}
            className={cn(
              "rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer",
              scale === "weeks"
                ? "bg-ink text-ink-inverse"
                : "text-ink-3 hover:text-ink",
            )}
          >
            Weeks
          </Button>
        </div>

        {/* Highlight Critical Path Button */}
        <Button
          variant="custom"
          type="button"
          onClick={onToggleHighlightCritical}
          className={cn(
            "flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
            highlightCritical
              ? "border-warning bg-warning-subtle text-warning-text"
              : "border-hairline bg-surface text-ink-2 hover:text-ink",
          )}
        >
          <FlameIcon className="size-3.5" />
          <span>Critical Path ({criticalCount})</span>
        </Button>
      </div>

      {/* Navigation & Jump to Today */}
      <div className="flex items-center gap-1.5">
        <Button
          variant="custom"
          type="button"
          onClick={() => setOffsetWeeks((w) => w - 1)}
          className="flex size-7 items-center justify-center rounded-lg border border-hairline bg-surface text-ink-2 hover:text-ink transition-colors cursor-pointer"
          title="Previous period"
        >
          <ChevronLeftIcon className="size-3.5" />
        </Button>
        <Button
          variant="custom"
          type="button"
          onClick={() => setOffsetWeeks(0)}
          className="rounded-lg border border-hairline bg-surface px-2.5 py-1 font-mono text-[11px] font-medium text-ink hover:bg-hover transition-colors cursor-pointer"
        >
          Today
        </Button>
        <Button
          variant="custom"
          type="button"
          onClick={() => setOffsetWeeks((w) => w + 1)}
          className="flex size-7 items-center justify-center rounded-lg border border-hairline bg-surface text-ink-2 hover:text-ink transition-colors cursor-pointer"
          title="Next period"
        >
          <ChevronRightIcon className="size-3.5" />
        </Button>
      </div>
    </div>
  );
};
