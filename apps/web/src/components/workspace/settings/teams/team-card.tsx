"use client";

import Link from "next/link";
import {
  Edit3Icon,
  FileTextIcon,
  LayoutGridIcon,
  SquareCheckIcon,
  Trash2Icon,
  UserPlusIcon,
} from "lucide-react";
import { ActorAvatar } from "~/src/components/actor-avatar";
import { usePermission } from "~/src/components/permissions/permission-provider";
import { paths } from "~/src/lib/paths";
import { Button } from "@kyren/ui/components/shadcn/button";
import { Card } from "@kyren/ui/components/shadcn/card";
import { cn } from "@kyren/ui";
import { getColorClass, sortMembers, type Team, type TeamScopeCounts } from "./teams-types";

type TeamActionsProps = {
  teamId: string;
  onEdit: () => void;
  onDelete: () => void;
};

export function TeamActions({ teamId, onEdit, onDelete }: TeamActionsProps) {
  const canUpdate = usePermission("teams.update", { teamId });
  const canManageMembers = usePermission("teams.members.manage", { teamId });
  const canDelete = usePermission("teams.delete", { teamId });

  return (
    <div className="-mx-1 flex flex-wrap gap-1 border-t border-hairline/70 pt-2.5">
      <Button variant="ghost" size="sm" disabled={!canUpdate} onClick={onEdit}>
        <Edit3Icon className="size-4" />
        Edit
      </Button>
      <Button
        variant="ghost"
        size="sm"
        disabled={!canManageMembers}
        onClick={onEdit}
      >
        <UserPlusIcon className="size-4" />
        Members
      </Button>
      <span className="flex-1" />
      <Button
        variant="ghost"
        size="sm"
        className="text-danger-text"
        disabled={!canDelete}
        onClick={onDelete}
      >
        <Trash2Icon className="size-4" />
        Delete
      </Button>
    </div>
  );
}

type TeamCardProps = {
  team: Team;
  counts?: TeamScopeCounts[string];
  onEdit: () => void;
  onDelete: () => void;
};

export function TeamCard({ team, counts, onEdit, onDelete }: TeamCardProps) {
  const shown = sortMembers(team.members).slice(0, 4);

  return (
    <Card className="gap-0 overflow-hidden rounded-xl py-0 shadow-none">
      <div className="flex items-center gap-2.5 border-b border-hairline bg-tint-teams px-4 py-3">
        <span
          aria-hidden="true"
          className={cn(
            "size-2.5 shrink-0 rounded-full",
            getColorClass(team.color),
          )}
        />
        <Link
          href={paths.teamSettings(team.id)}
          className="min-w-0 flex-1 truncate font-semibold outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        >
          {team.name}
        </Link>
        <span className="flex items-center">
          {shown.map((member) => (
            <span
              key={member.id}
              title={member.name}
              className="-ml-1.5 rounded-full ring-2 ring-surface first:ml-0"
            >
              <ActorAvatar name={member.name} size={22} />
            </span>
          ))}
          {team.members.length > shown.length ? (
            <span className="ml-1.5 font-mono text-xs text-ink-2">
              +{team.members.length - shown.length}
            </span>
          ) : null}
        </span>
      </div>
      <div className="flex flex-col gap-3 px-4 py-3.5">
        <p className="line-clamp-2 text-sm text-ink-2">
          {team.description || "No description yet."}
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-2">
          <span className="flex items-center gap-1.5">
            <LayoutGridIcon
              aria-hidden="true"
              className="size-3.5 text-ink-3"
            />
            {counts?.projects ?? 0}{" "}
            {counts?.projects === 1 ? "project" : "projects"}
          </span>
          <span className="flex items-center gap-1.5">
            <SquareCheckIcon
              aria-hidden="true"
              className="size-3.5 text-ink-3"
            />
            {counts?.tasks ?? 0} open tasks
          </span>
          <span className="flex items-center gap-1.5">
            <FileTextIcon
              aria-hidden="true"
              className="size-3.5 text-ink-3"
            />
            {counts?.docs ?? 0} docs
          </span>
          <span className="flex-1" />
          <span className="text-ink-3">
            {team.members.length}{" "}
            {team.members.length === 1 ? "member" : "members"}
          </span>
        </div>
        <TeamActions
          teamId={team.id}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </div>
    </Card>
  );
}
