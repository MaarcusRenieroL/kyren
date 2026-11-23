"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronLeftIcon, PlusIcon, Settings2Icon } from "lucide-react";
import { useTrpcClient } from "@zentro/api/react";
import { Button } from "@zentro/ui/shadcn/button";
import { Skeleton } from "@zentro/ui/shadcn/skeleton";
import { usePermission } from "~/src/components/permissions/permission-provider";
import { usePageCrumb } from "~/src/components/shell/breadcrumb-context";
import { TeamActivity } from "~/src/components/workspace/activity/activity-feed";
import { paths } from "~/src/lib/paths";
import { TeamWorkloadBalancer } from "./team-workload-balancer";
import type { TeamDetailData } from "./team-detail/types";
import { TeamProjectsSection } from "./team-detail/team-projects-section";
import { TeamTasksStream } from "./team-detail/team-tasks-stream";
import { TeamStatsCards } from "./team-detail/team-stats-cards";

/** One team: its numbers, projects, people and what happened lately. */
export function TeamDetail({ teamId }: { teamId: string }) {
  const trpc = useTrpcClient();
  const [data, setData] = useState<TeamDetailData | null>(null);
  const [missing, setMissing] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const canEdit = usePermission("teams.update", { teamId });
  const canManage = usePermission("teams.members.manage", { teamId });

  usePageCrumb(paths.teamSettings(teamId), data?.team.name);

  useEffect(() => {
    let live = true;

    Promise.all([
      trpc.team.getAll.query(),
      // Turned-off modules reject these calls; they simply show as empty.
      trpc.project.getProjectsByOrgId.query().catch(() => []),
      trpc.task.getTasksByOrgId.query({ teamId }).catch(() => []),
      trpc.docs.getAll.query({ teamId }).catch(() => []),
      trpc.team.getTeamWorkload.query({ id: teamId }).catch(() => null),
    ])
      .then(([teams, projects, tasks, docs, workload]) => {
        if (!live) return;

        const team = teams.find((entry) => entry.id === teamId);
        if (!team) {
          setMissing(true);
          return;
        }

        setData({
          team,
          projects: projects.filter(
            (project) => project.teamId === teamId && !project.archivedAt,
          ),
          tasks,
          docs,
          workload,
        });
      })
      .catch(() => live && setMissing(true));

    return () => {
      live = false;
    };
  }, [trpc, teamId, refreshToken]);

  if (missing) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line-strong px-6 py-14 text-center">
        <p className="font-display font-semibold text-xl tracking-tight text-ink">
          This team isn&apos;t here.
        </p>
        <p className="text-[15px] text-ink-2">
          It may have been deleted, or you don&apos;t have access to it.
        </p>
        <Button asChild variant="outline">
          <Link href={paths.teamsSettings()}>Back to teams</Link>
        </Button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-16 w-80" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const { team, projects, tasks, docs, workload } = data;
  const editHref = `${paths.teamsSettings()}?edit=${team.id}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          href={paths.teamsSettings()}
          className="flex w-fit items-center gap-1 text-[13px] text-ink-2 hover:text-ink"
        >
          <ChevronLeftIcon className="size-3.5" aria-hidden="true" />
          Teams
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <span
            aria-hidden="true"
            className="flex size-10 items-center justify-center rounded-md border border-hairline bg-tint-teams font-mono text-sm"
          >
            {team.name.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-[1_1_12rem]">
            <h1 className="font-display text-[1.75rem] leading-8 sm:text-[length:var(--title-size)] sm:leading-9">
              {team.name}
            </h1>
            {team.description ? (
              <p className="text-sm text-ink-2">{team.description}</p>
            ) : null}
          </div>
          {canEdit ? (
            <Button asChild variant="outline">
              <Link href={editHref}>
                <Settings2Icon />
                Edit team
              </Link>
            </Button>
          ) : null}
          {canManage ? (
            <Button asChild>
              <Link href={editHref}>
                <PlusIcon />
                Add people
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      <TeamStatsCards tasks={tasks} docs={docs} />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-6">
          <TeamProjectsSection projects={projects} />

          <section
            aria-labelledby="team-workload-balancer"
            className="flex flex-col"
          >
            <TeamWorkloadBalancer
              teamId={team.id}
              members={workload?.memberWorkload ?? []}
              tasks={workload?.tasks ?? []}
              onTasksUpdated={() => setRefreshToken((t) => t + 1)}
            />
          </section>

          <TeamTasksStream workload={workload} />
        </div>

        <section aria-labelledby="team-activity" className="tile p-4">
          <h2 id="team-activity" className="pb-3 font-semibold">
            Activity
          </h2>
          <TeamActivity teamId={team.id} />
        </section>
      </div>
    </div>
  );
}
