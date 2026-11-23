"use client";

import type { FC } from "react";
import Link from "next/link";
import { AlertTriangleIcon, FlameIcon } from "lucide-react";
import { StatusGlyph, PriorityMeter } from "@kyren/ui/components/status-glyph";
import { cn } from "@kyren/ui/lib/utils";
import { paths } from "~/src/lib/paths";
import { ActorAvatar } from "~/src/components/actor-avatar";
import type { Node } from "./types";

type DagStageNodeProps = {
  node: Node;
  isSelected: boolean;
  onSelect: () => void;
};

export const DagStageNode: FC<DagStageNodeProps> = ({
  node,
  isSelected,
  onSelect,
}) => {
  const isDone = node.status === "done";

  return (
    <div
      onClick={onSelect}
      className={cn(
        "group relative flex flex-col gap-2 rounded-xl border p-3 cursor-pointer transition-all shadow-xs",
        isSelected
          ? "ring-2 ring-signal border-signal bg-signal-subtle/30"
          : node.isCritical
            ? "border-signal/40 bg-surface hover:border-signal"
            : "border-hairline bg-surface hover:border-line-strong",
        isDone && "opacity-60",
      )}
    >
      {/* Critical path glow banner */}
      {node.isCritical ? (
        <div className="flex items-center justify-between text-[10px] font-mono font-semibold text-signal uppercase tracking-wider">
          <span className="inline-flex items-center gap-1">
            <FlameIcon className="size-3" /> Critical Path
          </span>
          {node.blocksCount > 0 ? (
            <span>Blocks {node.blocksCount}</span>
          ) : null}
        </div>
      ) : null}

      {/* Header row: Status glyph + key + priority */}
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <StatusGlyph status={node.status} size={12} />
          <Link
            href={paths.task(node.key)}
            onClick={(e) => e.stopPropagation()}
            className="font-mono text-xs font-medium text-ink hover:underline truncate"
          >
            {node.key}
          </Link>
        </div>
        <PriorityMeter priority={node.priority} />
      </div>

      {/* Title */}
      <p
        className={cn(
          "text-xs leading-snug line-clamp-2 text-ink-2",
          isDone && "line-through text-ink-3",
        )}
      >
        {node.title}
      </p>

      {/* Footer tags */}
      <div className="flex items-center justify-between pt-1 border-t border-hairline/40 text-[11px] text-ink-3">
        <div className="flex items-center gap-1.5">
          <ActorAvatar name={node.assignee} size={18} />
          <span className="truncate max-w-[80px]">
            {node.assignee.split(" ")[0]}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {node.estimatePoints ? (
            <span className="font-mono text-[10px] rounded bg-surface-subtle px-1 py-0.5">
              {node.estimatePoints}pt
            </span>
          ) : null}
          {node.isBottleneck ? (
            <span
              title={`Blocks ${node.blocksCount} tasks`}
              className="inline-flex items-center gap-0.5 text-[10px] font-mono text-warning-text font-semibold"
            >
              <AlertTriangleIcon className="size-3" />
              {node.blocksCount}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
};
