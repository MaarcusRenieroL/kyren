"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const sections = [
  { href: "/platform", label: "Tenants" },
  { href: "/platform/users", label: "Users" },
  { href: "/platform/health", label: "Health" },
  { href: "/platform/announcements", label: "Announcements" },
  { href: "/platform/settings", label: "Maintenance & network" },
  { href: "/platform/audit", label: "Audit trail" },
];

export function PlatformShell({
  name,
  email,
  children,
}: {
  name: string;
  email: string;
  children: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-dvh flex-col bg-canvas text-ink">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-line px-6 py-3">
        <span className="font-display text-lg">Zentro platform</span>
        <nav
          aria-label="Platform sections"
          className="flex flex-1 flex-wrap gap-1"
        >
          {sections.map((section) => {
            const current =
              section.href === "/platform"
                ? pathname === "/platform" ||
                  pathname.startsWith("/platform/tenants")
                : pathname.startsWith(section.href);

            return (
              <Link
                key={section.href}
                href={section.href}
                aria-current={current ? "page" : undefined}
                className={`rounded-lg px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  current
                    ? "bg-sunken font-medium text-ink"
                    : "text-ink-2 hover:text-ink"
                }`}
              >
                {section.label}
              </Link>
            );
          })}
        </nav>
        <span className="text-xs text-ink-2">
          {name} · {email}
        </span>
      </header>
      <main className="flex min-w-0 flex-1 flex-col gap-6 p-6">{children}</main>
    </div>
  );
}
