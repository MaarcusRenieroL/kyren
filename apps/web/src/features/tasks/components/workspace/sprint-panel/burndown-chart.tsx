"use client";

import { useTrpcClient } from "@zentro/api/react";
import type { AppRouter } from "@zentro/api/server";
import type { inferRouterOutputs } from "@trpc/server";
import { useAsyncData } from "~/src/lib/use-async-data";

type Sprint = inferRouterOutputs<AppRouter>["sprint"]["list"][number];

/** A small line chart: work left each day against the straight line to zero. */
export function Burndown({
  sprint,
  projectId,
}: {
  sprint: Sprint;
  projectId: string;
}) {
  const trpc = useTrpcClient();
  const data = useAsyncData(
    () =>
      trpc.sprint.burndown.query({
        projectId,
        id: sprint.id,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    [trpc, sprint.id, sprint.doneTasks],
  );

  if (!data.data) return null;

  const { days, total, length, unit } = data.data;
  const w = 320;
  const h = 90;
  const x = (i: number) => (length > 1 ? (i / (length - 1)) * w : 0);
  const y = (v: number) => h - (total > 0 ? (v / total) * h : 0);
  const line = (pick: (d: (typeof days)[number]) => number) =>
    days.map((d, i) => `${x(i)},${y(pick(d))}`).join(" ");

  return (
    <figure className="flex flex-col gap-1">
      <svg
        viewBox={`-4 -4 ${w + 8} ${h + 8}`}
        role="img"
        aria-label={`Burndown: ${days.at(-1)?.remaining ?? total} of ${total} ${unit} left`}
        className="h-24 w-full max-w-sm"
      >
        <polyline
          points={`0,${y(total)} ${w},${y(0)}`}
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.3"
          strokeDasharray="4 3"
        />
        <polyline
          points={line((d) => d.remaining)}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
      </svg>
      <figcaption className="text-xs text-ink-3">
        {days.at(-1)?.remaining ?? total} of {total} {unit} left
      </figcaption>
    </figure>
  );
}
