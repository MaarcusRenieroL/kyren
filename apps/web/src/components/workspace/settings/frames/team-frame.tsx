"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { PlusIcon } from "lucide-react";
import { useTrpcClient } from "@zentro/api/react";
import { Button } from "@zentro/ui/shadcn/button";
import { usePermissionMap } from "~/src/components/permissions/permission-provider";
import { paths } from "~/src/lib/paths";
import { FramedContext } from "./frame-context";
import { FrameTabs, type Tab } from "./frame-tabs";

/** Members, Invitations and Teams under one "Team" title. */
export function TeamFrame({ children }: { children: ReactNode }) {
  const trpc = useTrpcClient();
  const pathname = usePathname();
  const permissions = usePermissionMap();
  const [counts, setCounts] = useState<{
    members?: number;
    invitations?: number;
    teams?: number;
  }>({});

  useEffect(() => {
    let live = true;

    // Counts are a courtesy: a list the viewer cannot read just has none.
    Promise.all([
      permissions["members.view"]
        ? trpc.member.getMembers.query().catch(() => null)
        : null,
      permissions["invitations.view"]
        ? trpc.invitation.list.query().catch(() => null)
        : null,
      permissions["teams.view"]
        ? trpc.team.getAll.query().catch(() => null)
        : null,
    ]).then(([members, invitations, teams]) => {
      if (!live) return;

      setCounts({
        members: members?.length,
        invitations: invitations?.filter(
          (invitation) => invitation.status === "pending",
        ).length,
        teams: teams?.length,
      });
    });

    return () => {
      live = false;
    };
  }, [trpc, permissions, pathname]);

  const tabs: Tab[] = [
    permissions["members.view"]
      ? {
          href: paths.membersSettings(),
          label: "Members",
          count: counts.members,
        }
      : null,
    permissions["invitations.view"]
      ? {
          href: paths.invitationsSettings(),
          label: "Invitations",
          count: counts.invitations,
        }
      : null,
    permissions["teams.view"]
      ? { href: paths.teamsSettings(), label: "Teams", count: counts.teams }
      : null,
  ].filter((tab) => tab !== null);
  const onTeams = pathname === paths.teamsSettings();
  const action = onTeams
    ? permissions["teams.create"]
      ? { href: `${paths.teamsSettings()}?new=1`, label: "New team" }
      : null
    : permissions["members.invite"] && pathname !== paths.invitationsSettings()
      ? { href: paths.invitationsSettings(), label: "Invite people" }
      : null;

  // A team's own page has its own header.
  if (pathname.startsWith(`${paths.teamsSettings()}/`)) {
    return <FramedContext.Provider value>{children}</FramedContext.Provider>;
  }

  return (
    <FramedContext.Provider value>
      <div className="flex w-full flex-col">
        <div className="flex min-h-10 flex-wrap items-center gap-3">
          <h1 className="font-display text-[1.75rem] leading-8 sm:text-[length:var(--title-size)] sm:leading-9">
            Team
          </h1>
          <span className="flex-1" />
          {action ? (
            <Button asChild className="h-10 px-3.5 font-semibold">
              <Link href={action.href}>
                <PlusIcon />
                {action.label}
              </Link>
            </Button>
          ) : null}
        </div>
        <div className="mt-4">
          <FrameTabs tabs={tabs} label="Team" />
        </div>
        <div className="mt-5 min-w-0">{children}</div>
      </div>
    </FramedContext.Provider>
  );
}
