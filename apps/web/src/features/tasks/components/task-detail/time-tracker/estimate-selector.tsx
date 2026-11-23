"use client";

import { Button } from "@zentro/ui/shadcn/button";
import { HashIcon } from "lucide-react";
import { cn } from "@zentro/ui/lib/utils";

type Props = {
  estimatePoints: number | null;
  canEdit: boolean;
  onEstimateChange: (points: number | null) => void;
};

const pointOptions = [1, 2, 3, 5, 8, 13];

export function EstimateSelector({
  estimatePoints,
  canEdit,
  onEstimateChange,
}: Props) {
  return (
    <div className="mt-2 flex flex-col gap-1.5 border-t border-hairline pt-3">
      <span className="flex items-center gap-1.5 font-mono text-[11px] text-ink-3 uppercase tracking-wider">
        <HashIcon className="size-3" />
        Story Points Estimate
      </span>
      <div className="flex flex-wrap items-center gap-1.5">
        {pointOptions.map((pts) => {
          const isSelected = estimatePoints === pts;
          return (
            <Button
              variant="custom"
              key={pts}
              type="button"
              disabled={!canEdit}
              onClick={() => onEstimateChange(isSelected ? null : pts)}
              className={cn(
                "flex size-7 items-center justify-center rounded border font-mono text-xs transition-colors",
                isSelected
                  ? "border-primary bg-primary text-primary-foreground font-semibold"
                  : "border-hairline bg-surface hover:bg-hover text-ink-2",
              )}
            >
              {pts}
            </Button>
          );
        })}
        {estimatePoints !== null && !pointOptions.includes(estimatePoints) && (
          <span className="rounded border border-primary bg-primary px-2 py-1 font-mono text-xs text-primary-foreground">
            {estimatePoints} pts
          </span>
        )}
      </div>
    </div>
  );
}
