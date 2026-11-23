"use client";

import type { ReactNode } from "react";

import { InlineAlert } from "@kyren/ui/components/inline-alert";
import { errorMessage } from "~/src/lib/use-async-data";

const dateFormat = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function formatDate(value: Date | string | null | undefined) {
  return value ? dateFormat.format(new Date(value)) : "—";
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;

  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

export function Title({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="space-y-1">
        <h1 className="font-display text-2xl tracking-tight">{title}</h1>
        {description ? (
          <p className="max-w-2xl text-sm text-ink-2">{description}</p>
        ) : null}
      </div>
      {actions}
    </div>
  );
}

export function Failed({ error }: { error: unknown }) {
  return (
    <InlineAlert tone="danger" title="Could not load">
      {errorMessage(error)}
    </InlineAlert>
  );
}

export const tableClass = "w-full text-left text-sm";
export const headCell = "px-3 py-2 text-xs font-medium uppercase text-ink-2";
export const cell = "border-t border-line px-3 py-2 align-top";
