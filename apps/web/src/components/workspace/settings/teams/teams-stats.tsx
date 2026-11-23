"use client";

import { PlusIcon } from "lucide-react";
import { Button } from "@kyren/ui/components/shadcn/button";
import { sortMembers, type AvailableMember, type Team, type TeamScopeCounts } from "./teams-types";

type TeamsStatsProps = {
  teams: Team[];
  availableMembers: AvailableMember[];
  scopeCounts: TeamScopeCounts;
};

export function TeamsStats({
  teams,
  availableMembers,
  scopeCounts,
}: TeamsStatsProps) {
  const people = availableMembers.length;
  const inATeam = new Set(
    teams.flatMap((team) => team.members.map((member) => member.memberId)),
  );
  const noTeam = sortMembers(
    availableMembers.filter((member) => !inATeam.has(member.id)),
  );
  const largest = [...teams].sort(
    (a, b) => b.members.length - a.members.length,
  )[0];
  const ownedProjects = Object.values(scopeCounts).reduce(
    (total, counts) => total + counts.projects,
    0,
  );
  const archivedProjects = Object.values(scopeCounts).reduce(
    (total, counts) => total + counts.archived,
    0,
  );

  const firstNames = (list: AvailableMember[]) => {
    const names = list.map((member) => member.name);
    if (names.length <= 2) return names.join(" and ");
    return `${names.slice(0, 2).join(", ")} and ${names.length - 2} more`;
  };

  const stats = [
    {
      label: "Teams",
      value: teams.length,
      note: largest?.members.length
        ? `${largest.name} is the largest`
        : "None yet",
    },
    { label: "In a team", value: inATeam.size, note: `of ${people} people` },
    {
      label: "Projects owned",
      value: ownedProjects,
      note: `${ownedProjects - archivedProjects} active, ${archivedProjects} archived`,
    },
    {
      label: "No team",
      value: noTeam.length,
      note: noTeam.length ? firstNames(noTeam) : "Everyone has a team",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.label} className="tile flex flex-col gap-1 p-4">
          <span className="eyebrow">{stat.label}</span>
          <span className="font-mono font-semibold text-2xl leading-none text-ink tabular-nums">
            {stat.value}
          </span>
          <span className="truncate text-xs text-ink-2">{stat.note}</span>
        </div>
      ))}
    </div>
  );
}

export function TeamsEmptyState({
  canCreate,
  onCreate,
}: {
  canCreate: boolean;
  onCreate: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line-strong px-6 py-14 text-center">
      <p className="font-display font-semibold text-xl tracking-tight text-ink">
        No teams yet.
      </p>
      <p className="max-w-[440px] text-[15px] leading-[22px] text-ink-2">
        Teams group people who work together. Projects can belong to a team, and
        its members get access automatically.
      </p>
      {canCreate ? (
        <Button variant="outline" className="mt-3" onClick={onCreate}>
          <PlusIcon className="size-4" />
          New team
        </Button>
      ) : null}
    </div>
  );
}
