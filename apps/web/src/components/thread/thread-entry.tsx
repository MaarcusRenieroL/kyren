import type { ReactNode } from "react";
import { cn } from "@kyren/ui/lib/utils";

export const itemLink =
  "block rounded-md px-2 py-1.5 outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-ring";

export function Chip({ tint, children }: { tint: string; children: ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded-[6px] border border-hairline font-mono text-[9px] text-ink",
        tint,
      )}
    >
      {children}
    </span>
  );
}

export function Entry({
  kind,
  chip,
  title,
  sub,
  subClassName,
  strong = false,
}: {
  kind: string;
  chip: ReactNode;
  title: string;
  sub?: string;
  subClassName?: string;
  strong?: boolean;
}) {
  return (
    <span className="flex min-w-0 flex-col gap-0.5">
      <span className="font-mono text-[10px] tracking-[0.08em] text-ink-3 uppercase">
        {kind}
      </span>
      <span className="flex min-w-0 items-center gap-2">
        {chip}
        <span
          className={cn(
            "truncate text-sm text-ink",
            strong ? "font-semibold" : "font-medium",
          )}
        >
          {title}
        </span>
      </span>
      {sub ? (
        <span className={cn("font-mono text-[11px] text-ink-3", subClassName)}>
          {sub}
        </span>
      ) : null}
    </span>
  );
}
