"use client";

import { ClockIcon } from "lucide-react";
import type { TaskTimeLogItem } from "../types";
import { formatMinutes } from "./time-tracker-utils";

type Props = {
  timeLogs: TaskTimeLogItem[];
};

export function TimeLogHistory({ timeLogs }: Props) {
  if (timeLogs.length === 0) return null;

  return (
    <div className="mt-4 flex flex-col gap-1.5 border-t border-hairline pt-3">
      <span className="font-mono text-[11px] text-ink-3 uppercase tracking-wider">
        History ({timeLogs.length})
      </span>
      <div className="flex flex-col divide-y divide-hairline/60">
        {timeLogs.slice(0, 5).map((log) => (
          <div
            key={log.id}
            className="flex items-center justify-between py-1.5 text-xs"
          >
            <div className="flex min-w-0 items-center gap-2">
              <ClockIcon className="size-3 text-ink-3 shrink-0" />
              <span className="truncate text-ink-2">
                {log.note || "Logged work"}
              </span>
            </div>
            <span className="font-mono text-[11px] font-medium text-ink shrink-0">
              {formatMinutes(log.durationMinutes)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
