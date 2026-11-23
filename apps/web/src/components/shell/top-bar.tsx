"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CompassIcon, MenuIcon, SearchIcon } from "lucide-react";

import { Breadcrumbs } from "@zentro/ui/components/breadcrumbs";
import { Kbd } from "@zentro/ui/components/kbd";
import { Button } from "@zentro/ui/shadcn/button";
import { SidebarTrigger, useSidebar } from "@zentro/ui/shadcn/sidebar";

import { NotificationBell } from "~/src/components/notifications/notification-bell";
import {
  usePermission,
  useReachable,
} from "~/src/components/permissions/permission-provider";
import { getBreadcrumbs } from "~/src/lib/breadcrumbs";
import { paths } from "~/src/lib/paths";

import type { ShellModule } from "./app-sidebar";
import { useCrumbs } from "./breadcrumb-context";
import { AiCopilotBubble } from "./ai-copilot-bubble";
import { CommandPalette } from "./command-palette";
import { isRecentPath, useRecent } from "./use-recent";
import { OPEN_PALETTE_EVENT } from "~/src/components/system/open-palette-button";
import { useShell } from "./shell-context";
import { UserMenu } from "./user-menu";
import { TourStepper } from "~/src/components/walkthrough/tour-stepper";
import { TopBarCreateMenu, TopBarModals } from "./top-bar-create-actions";

type Props = {
  orgName?: string;
  enabledModules: string[];
  modules: ShellModule[];
  user: { name: string; email: string };
  links: { settingsHref: string | null; membersHref: string | null };
};

export function TopBar({
  orgName,
  enabledModules,
  modules,
  user,
  links,
}: Props) {
  const { toggleSidebar } = useSidebar();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const pathname = usePathname();
  const crumbs = useCrumbs();

  const activeTour = pathname.startsWith("/tasks")
    ? "tasks"
    : pathname.startsWith("/whiteboards")
      ? "whiteboards"
      : pathname.startsWith("/docs")
        ? "docs"
        : pathname.startsWith("/tickets")
          ? "tickets"
          : pathname.startsWith("/hr") || pathname.startsWith("/payroll")
            ? "hr"
            : "general";

  const { record } = useRecent();
  const entries = getBreadcrumbs(pathname, crumbs);
  const current = entries[entries.length - 1];

  // Remember tasks, docs and projects once their real name has loaded.
  useEffect(() => {
    if (isRecentPath(pathname) && current && !current.loading) {
      record({ href: pathname, label: current.label });
    }
  }, [pathname, current?.label, current?.loading, record]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pages without access to this state (404) open the palette by event.
  useEffect(() => {
    const open = () => setPaletteOpen(true);

    window.addEventListener(OPEN_PALETTE_EVENT, open);

    return () => window.removeEventListener(OPEN_PALETTE_EVENT, open);
  }, []);
  const { refreshPage } = useShell();
  const [creating, setCreating] = useState<"task" | "project" | "doc" | null>(
    null,
  );
  const canTask =
    useReachable("tasks.create") && enabledModules.includes("tasks");
  const canDoc = useReachable("docs.create") && enabledModules.includes("docs");
  const canProject =
    usePermission("projects.create") && enabledModules.includes("projects");

  // The trail starts at the organization, as the sidebar does.
  const trail = orgName
    ? [{ label: orgName, href: paths.dashboard() }, ...entries]
    : entries;

  return (
    <header
      data-slot="top-bar"
      className="sticky top-0 z-(--z-sticky) flex h-[52px] items-center gap-1.5 border-b border-hairline bg-canvas/85 px-2.5 backdrop-blur-md md:h-12 md:gap-2.5 md:px-4"
    >
      <SidebarTrigger className="hidden size-8 md:inline-flex" />
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleSidebar}
        aria-label="Open navigation"
        className="size-10 text-ink md:hidden"
      >
        <MenuIcon className="size-[18px]" />
      </Button>
      <div className="hidden min-w-0 flex-1 md:block">
        <Breadcrumbs LinkComponent={Link} items={trail} />
      </div>
      <span className="min-w-0 flex-1 truncate text-base font-semibold md:hidden">
        {current?.label}
      </span>
      <div className="ml-auto flex shrink-0 items-center gap-1.5 md:gap-2.5">
        <Button
          variant="custom"
          type="button"
          onClick={() => setPaletteOpen(true)}
          aria-label="Open command palette"
          className="hidden h-8 w-44 md:w-56 xl:w-[280px] items-center gap-2 rounded-lg border border-hairline bg-surface/80 px-2.5 text-left text-xs text-ink-3 shadow-2xs outline-none transition-all hover:border-ink-3 hover:bg-surface focus-visible:ring-2 focus-visible:ring-ring lg:flex"
        >
          <SearchIcon className="size-3.5 text-ink-3" aria-hidden="true" />
          <span className="flex-1 truncate">Search or jump to...</span>
          <Kbd className="text-[10px] bg-muted/60">⌘K</Kbd>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setPaletteOpen(true)}
          aria-label="Jump to a page"
          className="size-10 lg:hidden"
        >
          <SearchIcon className="size-[18px]" />
        </Button>

        <TopBarCreateMenu
          canTask={canTask}
          canDoc={canDoc}
          canProject={canProject}
          setCreating={setCreating}
        />

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setTourOpen(true)}
          className="hidden h-8 gap-1.5 px-2 text-xs text-ink-2 hover:text-ink sm:inline-flex"
          aria-label="Take a tour"
        >
          <CompassIcon className="size-3.5" />
          <span>Tour</span>
        </Button>
        <AiCopilotBubble />
        <NotificationBell />
        <UserMenu user={user} links={links} />
      </div>

      <TourStepper
        tourId={activeTour}
        open={tourOpen}
        onOpenChange={setTourOpen}
      />

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        modules={modules}
        actions={[
          ...(canTask
            ? [
                {
                  id: "task",
                  label: "New task",
                  key: "C",
                  run: () => setCreating("task"),
                },
              ]
            : []),
          ...(canDoc
            ? [
                {
                  id: "doc",
                  label: "New doc",
                  key: "D",
                  run: () => setCreating("doc"),
                },
              ]
            : []),
          ...(canProject
            ? [
                {
                  id: "project",
                  label: "New project",
                  key: "P",
                  run: () => setCreating("project"),
                },
              ]
            : []),
        ]}
      />

      <TopBarModals
        creating={creating}
        setCreating={setCreating}
        refreshPage={refreshPage}
        pathname={pathname}
      />
    </header>
  );
}
