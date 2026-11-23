import Link from "next/link";
import { cn } from "@kyren/ui/lib/utils";
import type { OverviewRow } from "~/src/lib/overview-data";

export function Breakdown({
  label,
  rows,
  empty,
}: {
  label: string;
  rows: OverviewRow[];
  empty: string;
}) {
  return (
    <div role="table" aria-label={label} className="flex flex-col">
      <div
        role="row"
        className="flex h-9 items-center gap-3 border-b border-hairline px-3 font-mono text-[11px] tracking-[0.08em] text-ink-3 uppercase"
      >
        <span role="columnheader" className="min-w-0 flex-1">
          {label}
        </span>
        <span role="columnheader" className="w-12 text-right">
          Open
        </span>
        <span role="columnheader" className="hidden w-16 text-right sm:block">
          Done 7d
        </span>
        <span role="columnheader" className="w-16 text-right">
          Overdue
        </span>
        <span role="columnheader" className="hidden w-36 md:block">
          Progress
        </span>
      </div>
      {rows.length ? (
        rows.map((row) => (
          <div
            role="row"
            key={row.id}
            className="relative flex min-h-12 items-center gap-3 border-b border-hairline/60 px-3 hover:bg-hover"
          >
            <span
              role="cell"
              className="flex min-w-0 flex-1 items-center gap-3"
            >
              <span
                aria-hidden="true"
                className="flex size-6 shrink-0 items-center justify-center rounded-sm border border-hairline bg-sunken font-mono text-[11px]"
              >
                {row.name.charAt(0).toUpperCase()}
              </span>
              <Link
                href={row.href}
                className="truncate text-[15px] font-medium outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-ring"
              >
                {row.name}
              </Link>
            </span>
            <span role="cell" className="w-12 text-right font-mono text-sm">
              {row.open}
            </span>
            <span
              role="cell"
              className="hidden w-16 text-right font-mono text-sm text-ink-2 sm:block"
            >
              {row.doneWeek}
            </span>
            <span
              role="cell"
              className={cn(
                "w-16 text-right font-mono text-sm",
                row.overdue ? "text-danger-text" : "text-ink-3",
              )}
            >
              {row.overdue ? `◆ ${row.overdue}` : 0}
            </span>
            <span role="cell" className="hidden w-36 md:block">
              <span className="block h-1.5 overflow-hidden rounded-full bg-sunken">
                <span
                  className="block h-full rounded-full bg-success"
                  style={{
                    width: `${row.total ? Math.round((row.done / row.total) * 100) : 0}%`,
                  }}
                />
              </span>
            </span>
          </div>
        ))
      ) : (
        <p className="px-3 py-4 text-sm text-ink-2">{empty}</p>
      )}
    </div>
  );
}
