import Link from "next/link";
import { cn } from "@zentro/ui/lib/utils";
import type { DashboardActivityItem } from "~/src/lib/dashboard-data";
import { paths } from "~/src/lib/paths";

export function ActivityTimeline({
  activity,
  canSeeAudit,
}: {
  activity: DashboardActivityItem[];
  canSeeAudit: boolean;
}) {
  return (
    <section
      aria-labelledby="overview-activity"
      className="tile flex flex-col gap-4 p-5"
    >
      <div className="flex items-baseline">
        <h2 id="overview-activity" className="flex-1 font-semibold">
          Activity
        </h2>
        {canSeeAudit ? (
          <Link
            href={paths.auditLogSettings()}
            className="text-sm text-signal-strong hover:underline"
          >
            Audit log
          </Link>
        ) : null}
      </div>
      {activity.length ? (
        <ol className="relative flex flex-col gap-4 before:absolute before:top-2 before:bottom-2 before:left-[4.5px] before:w-px before:bg-hairline">
          {activity.slice(0, 7).map((item) => (
            <li key={item.id} className="relative flex gap-3">
              <span
                aria-hidden="true"
                className={cn(
                  "mt-1.5 size-2.5 shrink-0 rounded-full bg-surface",
                  item.kind === "completed"
                    ? "bg-success"
                    : item.kind === "updated"
                      ? "border-2 border-warning"
                      : "border border-ink-3",
                )}
              />
              <Link
                href={item.href}
                className="group flex min-w-0 flex-col"
              >
                <span className="text-sm group-hover:text-signal">
                  <span className="font-medium">{item.user}</span>{" "}
                  <span className="text-ink-2">{item.action}</span>
                </span>
                <span className="font-mono text-[11px] text-ink-3">
                  {item.time}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-ink-2">
          Nothing yet. Changes across the organization show up here.
        </p>
      )}
    </section>
  );
}
