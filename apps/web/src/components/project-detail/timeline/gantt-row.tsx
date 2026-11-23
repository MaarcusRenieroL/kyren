import type { FC } from "react";
import { FlameIcon } from "lucide-react";
import { StatusGlyph } from "@kyren/ui/components/status-glyph";
import { cn } from "@kyren/ui/lib/utils";
import { ActorAvatar } from "~/src/components/actor-avatar";
import type { TimeBucket, TimelineTask } from "./types";

type GanttRowProps = {
  task: TimelineTask;
  timeBuckets: TimeBucket[];
  isSelected: boolean;
  onSelect: () => void;
};

export const GanttRow: FC<GanttRowProps> = ({
  task,
  timeBuckets,
  isSelected,
  onSelect,
}) => {
  return (
    <div
      onClick={onSelect}
      className={cn(
        "group grid grid-cols-[280px_minmax(0,1fr)] items-center transition-colors hover:bg-hover/50 cursor-pointer",
        isSelected && "bg-hover/80",
      )}
    >
      {/* Left Task Identity Column */}
      <div className="flex items-center gap-2.5 px-4 py-2.5 border-r border-hairline min-w-0">
        <StatusGlyph status={task.status} size={14} decorative />
        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[11px] font-semibold text-ink-2">
              {task.key}
            </span>
            {task.isCritical && (
              <span className="flex items-center gap-0.5 rounded px-1 py-0.2 bg-warning-subtle text-[9px] font-mono font-medium text-warning-text">
                <FlameIcon className="size-2.5" />
                Crit
              </span>
            )}
          </div>
          <span className="truncate text-xs font-medium text-ink">
            {task.title}
          </span>
        </div>
        <ActorAvatar name={task.assignee} size={18} />
      </div>

      {/* Right Gantt Bar Track */}
      <div className="relative h-10 w-full overflow-hidden px-1">
        {/* Grid Column Guidelines */}
        <div
          className="absolute inset-0 grid pointer-events-none"
          style={{
            gridTemplateColumns: `repeat(${timeBuckets.length}, minmax(0, 1fr))`,
          }}
        >
          {timeBuckets.map((bucket, idx) => (
            <div
              key={idx}
              className={cn(
                "border-r border-hairline/30 h-full",
                bucket.isToday && "bg-signal-subtle/20 border-signal/30",
              )}
            />
          ))}
        </div>

        {/* Interactive Gantt Bar */}
        <div
          style={{
            left: `${task.startPercent}%`,
            width: `${task.widthPercent}%`,
          }}
          className={cn(
            "absolute top-2 h-6 rounded-lg px-2 flex items-center justify-between text-[11px] font-medium shadow-xs transition-all cursor-pointer select-none",
            task.status === "done"
              ? "bg-status-done text-ink-inverse"
              : task.isCritical
                ? "bg-warning-subtle border border-warning text-warning-text font-semibold shadow-xs"
                : task.status === "in-progress"
                  ? "bg-signal text-on-signal"
                  : "bg-surface border border-hairline text-ink hover:border-hairline-strong",
          )}
          title={`${task.key}: ${task.title} (${task.computedStart.toLocaleDateString()} - ${task.computedDue.toLocaleDateString()})`}
        >
          <span className="truncate pr-1 text-[10px]">{task.key}</span>
          {task.estimatePoints ? (
            <span className="font-mono text-[9px] opacity-80 shrink-0">
              {task.estimatePoints}p
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
};
