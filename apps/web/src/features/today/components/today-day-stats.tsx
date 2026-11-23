"use client";

import Link from "next/link";
import { StatusGlyph } from "@kyren/ui/components/status-glyph";
import { DueDate } from "~/src/components/due-date";
import type { TodayTask } from "~/src/lib/today-data";

type TodayDayStatsProps = {
  done: number;
  planned: number;
  inProgress: number;
  next: Array<{ task: TodayTask }>;
  links: { tasks?: string };
};

export function TodayDayStats({
  done,
  planned,
  inProgress,
  next,
  links,
}: TodayDayStatsProps) {
  const total = Math.max(planned, done);
  const pct = total ? Math.min(100, Math.round((done / total) * 100)) : 0;

  return (
    <>
      <section
        aria-label="Your day"
        className="tile col-span-2 flex items-center gap-5 p-5 lg:col-span-4"
      >
        {total === 0 ? (
          <div className="flex size-[120px] shrink-0 items-center justify-center rounded-full border-2 border-dashed border-line-strong">
            <span className="sr-only">Nothing planned</span>
          </div>
        ) : (
          <div
            role="img"
            aria-label={`${done} of ${total} done`}
            className="flex size-[120px] shrink-0 items-center justify-center rounded-full"
            style={{
              background: `conic-gradient(var(--status-done) 0 ${pct}%, var(--hairline) ${pct}% 100%)`,
            }}
          >
            <div className="flex size-[84px] items-center justify-center rounded-full bg-surface font-mono text-xs text-ink-3">
              {pct}%
            </div>
          </div>
        )}
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="eyebrow">Your day</span>
          <span className="flex items-baseline gap-1.5">
            <span className="font-mono font-semibold text-3xl leading-none text-ink tabular-nums">
              {done}
            </span>
            <span className="font-mono text-[13px] text-ink-2">
              / {total} done
            </span>
          </span>
          <span className="text-[13px] leading-5 text-ink-2">
            {total === 0
              ? "Nothing planned. Tasks due today or picked for today count here."
              : done >= total
                ? "Everything planned is done. Nothing in progress."
                : `${inProgress} in progress · ${Math.max(total - done - inProgress, 0)} to do`}
          </span>
        </div>
      </section>

      <section
        aria-label="Then"
        className="tile col-span-2 px-2.5 pt-4 pb-2.5 lg:col-span-4"
      >
        <div className="flex items-baseline justify-between px-2.5 pb-2">
          <span className="eyebrow">Then</span>
          {links.tasks ? (
            <Link
              href={links.tasks}
              className="rounded-xs text-[13px] text-signal hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              All tasks
            </Link>
          ) : null}
        </div>
        {next.length ? (
          <ul>
            {next.map(({ task: item }) => (
              <li key={item.key}>
                <Link
                  href={item.href}
                  className="flex h-10 items-center gap-2.5 rounded-xl px-2.5 outline-none hover:bg-hover focus-visible:bg-hover"
                >
                  <StatusGlyph status={item.status} size={14} decorative />
                  <span className="w-[52px] flex-none font-mono text-xs text-ink-3">
                    {item.key}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {item.name}
                  </span>
                  {item.dueAt ? (
                    <DueDate value={item.dueAt} className="text-[13px]" />
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-2.5 py-4 text-[13px] text-ink-3">
            Nothing queued. New tasks land here after your focus task.
          </p>
        )}
      </section>
    </>
  );
}
