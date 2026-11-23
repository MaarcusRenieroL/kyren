"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTrpcClient } from "@zentro/api/react";
import type { AppRouter } from "@zentro/api/server";
import type { inferRouterOutputs } from "@trpc/server";
import { EmptyState } from "@zentro/ui/components/empty-state";
import { PageHeader } from "@zentro/ui/components/page-header";

export type Out = inferRouterOutputs<AppRouter>["admin"];

export const sections = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/usage", label: "Usage" },
  { href: "/admin/security", label: "Security" },
  { href: "/admin/api-keys", label: "API keys" },
  { href: "/admin/webhooks", label: "Webhooks" },
  { href: "/admin/task-fields", label: "Task fields" },
  { href: "/admin/retention", label: "Data retention" },
  { href: "/admin/network", label: "Network access" },
];

export const dateFormat = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;

  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-6 overflow-y-auto p-6">
      <PageHeader
        title="Administration"
        description="Usage, security and setup for the whole organization."
      />
      <nav
        aria-label="Administration sections"
        className="tab-scroll flex gap-1"
      >
        {sections.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            aria-current={pathname === section.href ? "page" : undefined}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              pathname === section.href
                ? "bg-sunken font-medium text-ink"
                : "text-ink-2 hover:bg-sunken"
            }`}
          >
            {section.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}

export function useAdminData<K extends keyof Out>(
  key: K,
): { data: Out[K] | null; failed: boolean } {
  const trpc = useTrpcClient();
  const [data, setData] = useState<Out[K] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const procedure = trpc.admin[key] as unknown as {
      query: () => Promise<Out[K]>;
    };

    procedure.query().then(setData, () => setFailed(true));
  }, [trpc, key]);

  return { data, failed };
}

export function Loading({ failed }: { failed: boolean }) {
  return failed ? (
    <EmptyState
      title="This did not load"
      description="Check your connection and reload the page."
    />
  ) : (
    <p role="status" className="text-sm text-ink-2">
      Loading…
    </p>
  );
}

export const Stat = ({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) => (
  <div className="rounded-xl border border-line p-4">
    <dt className="text-xs text-ink-2">{label}</dt>
    <dd className="font-mono text-xl text-ink">{value}</dd>
    {hint ? <dd className="text-xs text-ink-3">{hint}</dd> : null}
  </div>
);
