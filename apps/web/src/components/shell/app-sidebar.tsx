"use client";

import { Button } from "@kyren/ui/shadcn/button";
import { useChatBadge } from "~/src/components/chat/chat-store";
import { useNotifications } from "~/src/components/notifications/notifications-provider";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useEffect, useRef, useState } from "react";
import { ChevronDownIcon, XIcon } from "lucide-react";

import { authClient } from "@kyren/auth/client";
import { useTrpcClient } from "@kyren/api/react";
import { OrgSwitcher } from "@kyren/ui/components/org-switcher";
import { toastError } from "@kyren/ui/index";
import { useActiveBox } from "@kyren/ui/lib/use-active-box";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@kyren/ui/shadcn/sidebar";
import { cn } from "@kyren/ui/lib/utils";

import { getShellIcon } from "~/src/lib/module-icons";
import { apiPath, paths } from "~/src/lib/paths";
import { sidebarSectionLabel } from "~/src/lib/sidebar-navigation";
import { everyWhileVisible } from "~/src/lib/poll";

export type ShellModule = {
  id: string;
  label: string;
  href: string;
  icon: string;
  /** Pages under this path belong to the module. */
  base: string;
  /** Other paths whose pages read as part of the module. */
  bases?: string[];
};

type Props = {
  modules: ShellModule[];
  organizations: Array<{ id: string; name: string; slug: string }>;
  activeOrgSlug: string;
  /** "Admin · 18 people" under the organization name. */
  orgSubtitle?: string;
  /** Open tasks assigned to the user, shown on the Tasks item. */
  taskCount?: number;
};

/** The module a path belongs to: the longest matching base wins. */
export function findActiveModule(modules: ShellModule[], pathname: string) {
  let best: ShellModule | null = null;

  let bestLength = 0;

  for (const item of modules) {
    for (const base of [item.base, ...(item.bases ?? [])]) {
      if (pathname === base || pathname.startsWith(`${base}/`)) {
        if (base.length > bestLength) {
          best = item;
          bestLength = base.length;
        }
      }
    }
  }

  return best;
}

export function AppSidebar({
  modules,
  organizations,
  activeOrgSlug,
  orgSubtitle,
  taskCount,
}: Props) {
  const pathname = usePathname();
  const chatBadge = useChatBadge(modules.some((item) => item.id === "chat"));
  const active = findActiveModule(modules, pathname);
  const defaultSection =
    active && active.id !== "settings" ? sidebarSectionLabel(active.id) : "Work";
  const { items: notifications } = useNotifications();
  const trpc = useTrpcClient();
  const mailEnabled = modules.some((item) => item.id === "mail");
  const [mailUnread, setMailUnread] = useState(0);

  useEffect(() => {
    if (!mailEnabled) return;

    let live = true;
    const load = () =>
      trpc.mail.unread
        .query()
        .then(({ count }) => {
          if (live) setMailUnread(count);
        })
        .catch(() => undefined);

    void load();
    const stop = everyWhileVisible(load, 30_000);
    return () => {
      live = false;
      stop();
    };
  }, [mailEnabled, pathname, trpc]);

  const unreadByModule = new Map([
    ["chat", chatBadge],
    ["mail", mailUnread],
  ]);
  for (const notification of notifications) {
    if (!notification.unread || !notification.href) continue;

    const [destination = ""] = notification.href.split(/[?#]/, 1);
    const target = findActiveModule(modules, destination);
    if (!target || target.id === "chat" || target.id === "mail") continue;

    unreadByModule.set(target.id, (unreadByModule.get(target.id) ?? 0) + 1);
  }

  const unreadBySection = new Map<string, number>();
  for (const { id } of modules) {
    if (id === "settings") continue;

    const section = sidebarSectionLabel(id);
    unreadBySection.set(
      section,
      (unreadBySection.get(section) ?? 0) + (unreadByModule.get(id) ?? 0),
    );
  }
  const listRef = useRef<HTMLUListElement>(null);
  const box = useActiveBox(listRef, '[data-active="true"]');
  const { isMobile, setOpenMobile, state } = useSidebar();
  const [sectionOverrides, setSectionOverrides] = useState<{
    pathname: string;
    expanded: Record<string, boolean>;
  }>();
  if (sectionOverrides && sectionOverrides.pathname !== pathname) {
    setSectionOverrides(undefined);
  }
  const expandedOverrides = sectionOverrides?.pathname === pathname
    ? sectionOverrides.expanded
    : undefined;
  const iconOnly = !isMobile && state === "collapsed";
  const itemSize = isMobile ? "h-11 text-[15px]" : "h-9";
  const close = () => setOpenMobile(false);
  const switchOrganization = async (organizationId: string) => {
    const { error } = await authClient.organization.setActive({
      organizationId,
    });

    if (error) {
      toastError(error, "Could not switch organization");

      return;
    }

    // A full load, so every query starts from the new organization.
    window.location.assign(apiPath(paths.dashboard()));
  };

  return (
    <Sidebar collapsible="icon" variant="sidebar" aria-label="Main">
      <SidebarHeader className="flex-row items-center gap-2 px-3 pt-3 pb-0">
        <div className="flex-1 min-w-0">
          <OrgSwitcher
            organizations={organizations}
            activeOrgSlug={activeOrgSlug}
            createOrganizationHref={paths.auth.createOrganization()}
            onSwitchOrganization={switchOrganization}
            subtitle={orgSubtitle}
            mark={
              <span
                aria-hidden="true"
                className="flex size-[26px] shrink-0 items-center justify-center rounded-lg bg-ink"
              >
                <span className="h-[13px] w-0.5 rounded-xs bg-signal" />
              </span>
            }
            className="h-12 w-full rounded-md border border-hairline bg-surface px-2"
          />
        </div>
        {/* Only the phone drawer needs its own close button; on wider
            screens the top bar's sidebar toggle (or ⌘B) collapses it. */}
        {isMobile ? (
          <Button
            variant="custom"
            type="button"
            onClick={close}
            aria-label="Close navigation"
            className="flex size-9 shrink-0 items-center justify-center rounded-md text-ink-2 outline-none transition-colors hover:bg-hover hover:text-ink focus-visible:ring-2 focus-visible:ring-ring group-data-[collapsible=icon]:hidden"
          >
            <XIcon className="size-4" aria-hidden="true" />
          </Button>
        ) : null}
      </SidebarHeader>

      <SidebarContent className="gap-0 px-3 pt-3.5 pb-3">
        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            <SidebarMenu ref={listRef} className="relative gap-0.5">
              {box ? (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute top-0 left-0 rounded-md bg-selected transition-[transform,width,height] duration-[var(--duration-base)] ease-[var(--ease-out)]"
                  style={{
                    width: box.width,
                    height: box.height,
                    transform: `translate(${box.left}px, ${box.top}px)`,
                  }}
                />
              ) : null}
              {modules
                .filter((item) => item.id !== "settings")
                .map((item, index, items) => {
                  const Icon = getShellIcon(item.id, item.icon);
                  const isActive = item.id === active?.id;
                  const section = sidebarSectionLabel(item.id);
                  const expanded =
                    iconOnly || (expandedOverrides?.[section] ?? section === defaultSection);
                  const unread = unreadByModule.get(item.id) ?? 0;
                  const previous = items[index - 1];
                  const startsSection =
                    !previous || section !== sidebarSectionLabel(previous.id);

                  return (
                    <Fragment key={item.id}>
                      {startsSection ? (
                        <li className="px-2 pt-3 pb-1 first-of-type:pt-0 group-data-[collapsible=icon]:hidden">
                          <h2>
                            <button
                              type="button"
                              aria-expanded={expanded}
                              data-state={expanded ? "open" : "closed"}
                              onClick={() =>
                                setSectionOverrides((current) => ({
                                  pathname,
                                  expanded: {
                                    ...(current?.pathname === pathname ? current.expanded : undefined),
                                    [section]: !expanded,
                                  },
                                }))
                              }
                              className="flex min-h-7 w-full items-center justify-between gap-2 rounded-sm text-left text-xs font-medium text-ink-3 hover:text-ink focus-visible:outline-2 focus-visible:outline-ring"
                            >
                              <span className="flex-1">{section}</span>
                              {!expanded && (
                                <UnreadBadge count={unreadBySection.get(section) ?? 0} />
                              )}
                              <ChevronDownIcon
                                aria-hidden="true"
                                className={cn(
                                  "size-3.5 shrink-0 motion-safe:transition-transform",
                                  expanded && "rotate-180",
                                )}
                              />
                            </button>
                          </h2>
                        </li>
                      ) : null}
                      {expanded ? (
                        <SidebarMenuItem className="relative z-[1]">
                          <SidebarMenuButton
                            asChild
                            isActive={isActive}
                            tooltip={item.label}
                            className={cn(
                              itemSize,
                              "rounded-lg text-ink-2 transition-all hover:bg-hover hover:text-ink data-active:bg-selected data-active:font-semibold data-active:text-ink shadow-2xs",
                            )}
                          >
                            <Link
                              href={item.href}
                              onClick={close}
                              aria-current={isActive ? "page" : undefined}
                              className="flex items-center gap-2.5"
                            >
                              <Icon
                                className={cn(
                                  "size-4 shrink-0 transition-colors",
                                  isActive
                                    ? "text-signal font-semibold"
                                    : "text-ink-3",
                                )}
                              />
                              <span className="flex-1 truncate group-data-[collapsible=icon]:hidden">
                                {item.label}
                              </span>
                              {item.id === "tasks" && taskCount ? (
                                <span aria-label={`${taskCount} open assigned tasks`} className="font-mono text-[11px] font-semibold px-1.5 py-0.2 rounded-full bg-signal/10 text-signal group-data-[collapsible=icon]:hidden">
                                  {taskCount}
                                </span>
                              ) : null}
                              <UnreadBadge count={unread} />
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ) : null}
                    </Fragment>
                  );
                })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {modules.some((item) => item.id === "settings") ? (
        <SidebarFooter className="px-3 pt-0 pb-3">
          {modules
            .filter((item) => item.id === "settings")
            .map((item) => {
              const Icon = getShellIcon(item.id, item.icon);
              const isActive = item.id === active?.id;

              return (
                <SidebarMenu key={item.id}>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.label}
                      className={cn(
                        itemSize,
                        "rounded-md text-ink-2 hover:bg-hover hover:text-ink data-active:bg-selected data-active:font-medium data-active:text-ink",
                      )}
                    >
                      <Link
                        href={item.href}
                        onClick={close}
                        aria-current={isActive ? "page" : undefined}
                      >
                        <Icon
                          className={isActive ? "text-signal" : undefined}
                        />
                        <span className="group-data-[collapsible=icon]:hidden">
                          {item.label}
                        </span>
                        <UnreadBadge count={unreadByModule.get(item.id) ?? 0} />
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              );
            })}
        </SidebarFooter>
      ) : null}
    </Sidebar>
  );
}

function UnreadBadge({ count }: { count: number }) {
  if (count === 0) return null;

  return (
    <span
      aria-label={`${count} unread`}
      className="rounded-full bg-signal/10 px-1.5 font-mono text-[11px] font-semibold text-signal group-data-[collapsible=icon]:hidden"
    >
      {count}
    </span>
  );
}
