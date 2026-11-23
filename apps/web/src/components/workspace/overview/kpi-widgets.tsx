import type { ReactNode } from "react";
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import { cn } from "@zentro/ui/lib/utils";

export function Pill({ children, tone }: { children: ReactNode; tone?: "bad" }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1 rounded-full border border-hairline px-2 py-0.5 font-mono text-[11px] text-ink-2",
        tone === "bad" && "text-danger-text",
      )}
    >
      {children}
    </span>
  );
}

/** "↑ 12% vs last week", or "Same as last week". */
export function Change({
  now,
  before,
  suffix,
  percent = false,
  bad = false,
}: {
  now: number;
  before: number;
  suffix: string;
  percent?: boolean;
  /** Up is the wrong direction (overdue work). */
  bad?: boolean;
}) {
  const diff = now - before;

  if (diff === 0 && percent) {
    return <Pill>Same as last week</Pill>;
  }

  const value =
    percent && before > 0
      ? `${Math.round((Math.abs(diff) / before) * 100)}%`
      : String(Math.abs(diff));
  const Icon = diff < 0 ? ArrowDownIcon : ArrowUpIcon;

  return (
    <Pill tone={diff > 0 && bad ? "bad" : undefined}>
      {diff !== 0 ? <Icon className="size-3" aria-hidden="true" /> : null}
      {value} {suffix}
    </Pill>
  );
}

export function Kpi({
  label,
  value,
  of,
  tone,
  children,
}: {
  label: string;
  value: number;
  of?: number;
  tone?: "bad";
  children: ReactNode;
}) {
  return (
    <div className="tile flex min-w-0 flex-col gap-2 p-4">
      <span className="eyebrow">{label}</span>
      <span className="flex items-baseline gap-1.5">
        <span
          className={cn(
            "font-mono font-semibold text-3xl leading-tight tabular-nums tracking-tight text-ink",
            tone === "bad" && value > 0 && "text-danger-text",
          )}
        >
          {value}
        </span>
        {of !== undefined ? (
          <span className="font-mono text-xs text-ink-3">/ {of}</span>
        ) : null}
      </span>
      {children}
    </div>
  );
}
