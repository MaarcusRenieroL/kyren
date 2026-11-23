"use client";

import Link from "next/link";
import { StatusGlyph } from "@kyren/ui/components/status-glyph";
import type { PulseItem } from "@kyren/ui/components/team-pulse";
import { cn } from "@kyren/ui/lib/utils";
import { ActorAvatar } from "~/src/components/actor-avatar";
import type { DashboardWorkItem } from "~/src/lib/dashboard-data";
import { paths } from "~/src/lib/paths";
import type { TodayData } from "~/src/lib/today-data";
import { workTint } from "../today-helpers";

type TodayPulseAndHistoryProps = {
  pulse: PulseItem[];
  fresh: ReadonlySet<string>;
  data: TodayData;
  canInvite: boolean;
  recentWork: DashboardWorkItem[];
};

export function TodayPulseAndHistory({
  pulse,
  fresh,
  data,
  canInvite,
  recentWork,
}: TodayPulseAndHistoryProps) {
  const workingNow = new Set(
    pulse
      .filter((item) => item.verb === "started" || item.verb === "moved")
      .map((item) => item.actor),
  ).size;

  const weekTotal = data.week.reduce((sum, day) => sum + day.count, 0);
  const todayIndex = data.week.length - 1;

  return (
    <>
      <section
        aria-label="Team pulse"
        className="tile col-span-2 px-2.5 pt-4 pb-2.5 lg:col-span-7"
      >
        <div className="flex items-center gap-2.5 px-2.5 pb-2">
          <h2 className="text-[15px] font-semibold">Team pulse</h2>
          <span className="flex-1" />
          {workingNow > 0 ? (
            <span className="flex items-center gap-2 font-mono text-xs text-ink-2">
              <span
                aria-hidden="true"
                className="size-2 rounded-full bg-status-done motion-safe:animate-[zpulse_2.4s_ease-out_infinite]"
              />
              {workingNow} working now
            </span>
          ) : null}
        </div>
        {pulse.length ? (
          <ul>
            {pulse.slice(0, 4).map((item) => (
              <li
                key={item.id}
                className={cn(
                  fresh.has(item.id) && "motion-safe:animate-pulse-in",
                )}
              >
                <Link
                  href={item.href ?? "#"}
                  className="flex h-11 items-center gap-3 rounded-xl px-2.5 outline-none hover:bg-hover focus-visible:bg-hover"
                >
                  <ActorAvatar name={item.actor} />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    <span className="font-medium">{item.actor}</span>{" "}
                    <span className="text-ink-2">{item.verb}</span>{" "}
                    {item.taskKey ? (
                      <span className="font-mono text-[13px]">
                        {item.taskKey}
                      </span>
                    ) : null}{" "}
                    <span className="text-ink-2">{item.title}</span>
                  </span>
                  <StatusGlyph
                    status={
                      item.verb === "finished"
                        ? "done"
                        : item.verb === "moved"
                          ? "review"
                          : item.verb === "created"
                            ? "todo"
                            : "in-progress"
                    }
                    size={12}
                    decorative
                  />
                  <span className="w-10 text-right font-mono text-xs text-ink-3">
                    {item.when}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col gap-2 px-2.5 pt-3.5 pb-2.5 text-sm text-ink-2">
            {data.hasAnyTasks
              ? "Nobody has moved work yet today. Starts, moves and finishes show up here as they happen."
              : "You’re the only one here so far. Invite teammates to see who started, moved and finished work."}
            {!data.hasAnyTasks && canInvite ? (
              <Link
                href={paths.invitationsSettings()}
                className="self-start rounded-xs text-signal hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                Invite people
              </Link>
            ) : null}
          </div>
        )}
      </section>

      <section
        aria-label="Last 7 days"
        className="tile col-span-2 flex flex-col gap-3.5 px-5 pt-4 pb-[18px] lg:col-span-5"
      >
        <div className="flex items-baseline justify-between">
          <h2 className="text-[15px] font-semibold">Last 7 days</h2>
          <span className="font-mono text-xs text-ink-2">
            {weekTotal} done
          </span>
        </div>
        <div className="grid flex-1 grid-cols-7 gap-1.5">
          {data.week.map((day, index) => (
            <div
              key={`${day.label}-${index}`}
              className="flex flex-col items-center gap-1.5"
            >
              <div className="flex flex-1 flex-col-reverse justify-start gap-1">
                {Array.from({ length: 7 }, (_, dot) => (
                  <span
                    key={dot}
                    className={cn(
                      "size-2.5 rounded-full",
                      dot < day.count ? "bg-status-done" : "bg-hairline",
                    )}
                  />
                ))}
              </div>
              <span className="font-mono text-[11px] text-ink-2">
                {day.count}
              </span>
              <span
                className={cn(
                  "font-mono text-[11px]",
                  index === todayIndex
                    ? "font-semibold text-ink"
                    : "text-ink-3",
                )}
              >
                {day.label}
              </span>
            </div>
          ))}
        </div>
      </section>

      <div className="col-span-2 mt-2 flex flex-wrap items-baseline justify-between gap-2 lg:col-span-12">
        <h2 className="eyebrow">Recent work</h2>
        {recentWork.length ? null : (
          <span className="text-[13px] text-ink-3">
            Docs, projects and tasks you open will appear here.
          </span>
        )}
      </div>
      {recentWork.length ? (
        <>
          {recentWork.slice(0, 4).map((item) => (
            <Link
              key={`${item.kind}-${item.id}`}
              href={item.href}
              className={cn(
                "tile col-span-1 flex min-h-32 flex-col gap-1.5 p-[18px] outline-none hover:border-ink-3 focus-visible:ring-2 focus-visible:ring-ring lg:col-span-3",
                workTint[item.kind],
              )}
            >
              <span className="font-mono text-[11px] tracking-[0.08em] text-ink-2 uppercase">
                {item.kind}
              </span>
              <span className="line-clamp-3 text-[15px] leading-5 font-semibold break-words">
                {item.title}
              </span>
              <span className="mt-auto font-mono text-xs text-ink-2">
                {item.label} · {item.updatedAt}
              </span>
            </Link>
          ))}
        </>
      ) : null}
    </>
  );
}
