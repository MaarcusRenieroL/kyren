"use client";

import { Button } from "@zentro/ui/shadcn/button";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@zentro/ui/lib/utils";
import { Skeleton } from "@zentro/ui/shadcn/skeleton";

export const where = (channelName: string | null, channelId: string) =>
  channelName ? `/chat/${channelName}` : `/chat/dm/${channelId}`;

export const above = "relative [&_a]:relative";

/** A page of one kind of list: icon, title, count and a body. */
export function ListPage({
  icon,
  title,
  count,
  actions,
  children,
}: {
  icon: ReactNode;
  title: string;
  count?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-5">
      <div className="flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-md bg-tint-teams">
          {icon}
        </span>
        <h2 className="text-xl font-semibold">{title}</h2>
        {count ? (
          <span className="rounded-full border border-hairline px-2 py-px font-mono text-xs text-ink-2">
            {count}
          </span>
        ) : null}
        <span className="flex-1" />
        {actions}
      </div>
      {children}
    </div>
  );
}

/** A row whose whole area opens a conversation, with its own links on top. */
export function JumpRow({
  href,
  label,
  children,
  className,
}: {
  href: string;
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "group relative flex gap-3 rounded-lg border-t border-hairline/60 px-3 py-3 hover:bg-hover",
        className,
      )}
    >
      <Link
        href={href}
        aria-label={label}
        className="absolute inset-0 rounded-lg"
      />
      {children}
    </div>
  );
}

export function ListEmpty({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-16 text-center">
      <p className="font-display font-semibold text-lg tracking-tight text-ink">
        {title}
      </p>
      <p className="max-w-sm text-[15px] text-ink-2">{hint}</p>
    </div>
  );
}

export function ListSkeleton() {
  return (
    <div className="flex flex-col gap-3 pt-5" aria-busy="true">
      {[0, 1, 2].map((row) => (
        <Skeleton key={row} className="h-14" />
      ))}
    </div>
  );
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: ReadonlyArray<readonly [T, string, number]>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div
      role="tablist"
      className="mt-4 flex gap-5 border-b border-hairline text-[15px]"
    >
      {tabs.map(([key, label, count]) => (
        <Button
          variant="custom"
          key={key}
          type="button"
          role="tab"
          aria-selected={value === key}
          onClick={() => onChange(key)}
          className={cn(
            "-mb-px border-b-2 py-2.5",
            value === key
              ? "border-ink font-medium"
              : "border-transparent text-ink-2 hover:text-ink",
          )}
        >
          {label}
          <span className="ml-1.5 font-mono text-xs text-ink-3">{count}</span>
        </Button>
      ))}
    </div>
  );
}
