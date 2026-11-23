import type { FC } from "react";
import Link from "next/link";
import { CalendarIcon } from "lucide-react";
import { StatusGlyph } from "@zentro/ui/components/status-glyph";
import { paths } from "~/src/lib/paths";
import type { TimelineTask } from "./types";

type SelectedTaskBarProps = {
  selectedTask: TimelineTask;
};

export const SelectedTaskBar: FC<SelectedTaskBarProps> = ({ selectedTask }) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-hairline bg-surface p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <StatusGlyph status={selectedTask.status} size={16} decorative />
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold text-ink-2">
              {selectedTask.key}
            </span>
            <span className="text-xs text-ink-3">·</span>
            <span className="text-xs text-ink-3">
              Assignee: {selectedTask.assignee}
            </span>
          </div>
          <span className="text-sm font-semibold text-ink">
            {selectedTask.title}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 font-mono text-xs text-ink-3">
          <CalendarIcon className="size-3.5" />
          <span>
            {selectedTask.computedStart.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}{" "}
            -{" "}
            {selectedTask.computedDue.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </span>
        </div>

        <Link
          href={paths.task(selectedTask.key)}
          className="rounded-xl bg-ink px-3 py-1.5 text-xs font-medium text-ink-inverse hover:opacity-90 transition-opacity"
        >
          Open Task
        </Link>
      </div>
    </div>
  );
};
