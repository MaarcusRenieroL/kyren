"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@kyren/ui/lib/utils";
import {
  useBaseRole,
  usePermissionMap,
} from "~/src/components/permissions/permission-provider";
import { paths } from "~/src/lib/paths";

export type Tab = { href: string; label: string; count?: number; prefix?: boolean };

export const teamPaths = [
  paths.membersSettings(),
  paths.invitationsSettings(),
  paths.teamsSettings(),
];

export const adminPaths = [
  paths.rolesSettings(),
  paths.modulesSettings(),
  paths.auditLogSettings(),
];

export function inArea(pathname: string, area: string[]) {
  return area.some(
    (href) => pathname === href || pathname.startsWith(`${href}/`),
  );
}

/** Underline tabs that link to pages, with optional mono counts. */
export function FrameTabs({ tabs, label }: { tabs: Tab[]; label: string }) {
  const pathname = usePathname();

  return (
    <nav
      data-slot="section-nav"
      aria-label={label}
      className="tab-scroll flex gap-5 border-b border-hairline text-[15px]"
    >
      {tabs.map((tab) => {
        const active =
          pathname === tab.href ||
          Boolean(tab.prefix && pathname.startsWith(`${tab.href}/`));

        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px flex items-baseline gap-1.5 border-b-2 py-2.5 whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "border-ink font-medium text-ink"
                : "border-transparent text-ink-2 hover:text-ink",
            )}
          >
            {tab.label}
            {tab.count !== undefined ? (
              <span className="font-mono text-xs text-ink-3">{tab.count}</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

export const roleTabs: Tab[] = [
  { href: paths.rolesSettings(), label: "Roles" },
  { href: paths.rolesAssignments(), label: "Assignments" },
  { href: paths.accessCheck(), label: "Access check" },
  { href: paths.permissionLog(), label: "Permission log" },
];

/** The roles area's own pages as a small segmented nav. */
export function RoleTabs() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Roles and access"
      className="tab-scroll flex w-fit max-w-full gap-0.5 rounded-md border border-hairline bg-surface p-1"
    >
      {roleTabs.map((tab) => {
        const active = pathname === tab.href;

        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-sm px-3 py-1.5 text-sm whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "bg-ink font-medium text-ink-inverse"
                : "text-ink-2 hover:bg-hover hover:text-ink",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

export const adminTitles: Array<[string, string]> = [
  [paths.rolesSettings(), "Roles & access"],
  [paths.modulesSettings(), "Modules"],
  [paths.auditLogSettings(), "Audit log"],
];

/** The admin area tabs: Overview, Roles & access, Modules, Audit log. */
export function AdminTabs() {
  const permissions = usePermissionMap();
  const baseRole = useBaseRole();
  const admin = baseRole === "owner" || baseRole === "admin";
  const tabs: Tab[] = [
    admin ? { href: paths.overview(), label: "Overview" } : null,
    permissions["roles.view"]
      ? { href: paths.rolesSettings(), label: "Roles & access", prefix: true }
      : null,
    permissions["modules.view"]
      ? { href: paths.modulesSettings(), label: "Modules" }
      : null,
    permissions["audit_logs.view"]
      ? { href: paths.auditLogSettings(), label: "Audit log" }
      : null,
  ].filter((tab) => tab !== null);

  return <FrameTabs tabs={tabs} label="Administration" />;
}
