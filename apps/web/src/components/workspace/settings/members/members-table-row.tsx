"use client";

import type { FC } from "react";
import { MoreHorizontalIcon, ShieldIcon, Trash2Icon } from "lucide-react";
import { ActorAvatar } from "~/src/components/actor-avatar";
import { Button } from "@zentro/ui/components/shadcn/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@zentro/ui/components/shadcn/dropdown-menu";
import { cn } from "@zentro/ui/lib/utils";
import type { Member } from "~/src/lib/types";

import { dotFor, monthYear, RoleControl, shortAgo, type Role } from "./members-helpers";

type MembersTableRowProps = {
  member: Member;
  userId: string;
  extras?: { teams: string[]; lastActive: string | null };
  canTransfer: boolean;
  canManageAccess: boolean;
  canRemoveMembers: boolean;
  canUpdateMemberRoles: boolean;
  onRoleChange: (memberId: string, role: Role) => void;
  onManageAccess: (member: Member) => void;
  onRemove: (member: Member) => void;
};

export const MembersTableRow: FC<MembersTableRowProps> = ({
  member,
  userId,
  extras,
  canTransfer,
  canManageAccess,
  canRemoveMembers,
  canUpdateMemberRoles,
  onRoleChange,
  onManageAccess,
  onRemove,
}) => {
  const isCurrentUser = member.userId === userId;
  const teams = extras?.teams ?? [];
  const lastActive = shortAgo(extras?.lastActive ?? null);
  const outranks =
    member.role === "owner" || (member.role === "admin" && !canTransfer);
  const canAct =
    !isCurrentUser && !outranks && (canRemoveMembers || canManageAccess);

  return (
    <div
      role="row"
      className="flex min-h-[57px] items-center gap-3 border-b border-hairline/60 px-3 py-2"
    >
      <span role="cell" className="flex min-w-0 flex-1 items-center gap-3">
        <ActorAvatar name={member.user.name} size={32} />
        <span className="flex min-w-0 flex-col">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-[15px] font-medium">
              {member.user.name}
            </span>
            {isCurrentUser ? (
              <span className="rounded-xs border border-hairline px-1.5 font-mono text-[10px] text-ink-2 uppercase">
                You
              </span>
            ) : null}
          </span>
          <span className="truncate font-mono text-xs text-ink-3">
            {member.user.email}
          </span>
        </span>
      </span>
      <span role="cell" className="w-28 sm:w-32">
        <RoleControl
          disabled={!canUpdateMemberRoles || outranks}
          isCurrentUser={isCurrentUser}
          member={member}
          onRoleChange={onRoleChange}
        />
      </span>
      <span
        role="cell"
        className="hidden w-32 items-center gap-2 text-sm text-ink-2 lg:flex"
      >
        {teams.length ? (
          <>
            <span
              aria-hidden="true"
              className={cn(
                "size-2 shrink-0 rounded-full border border-hairline",
                dotFor(teams[0]!),
              )}
            />
            <span className="truncate" title={teams.join(", ")}>
              {teams[0]}
              {teams.length > 1 ? ` +${teams.length - 1}` : ""}
            </span>
          </>
        ) : (
          <>
            <span
              aria-hidden="true"
              className="size-2 shrink-0 rounded-full border border-dashed border-ink-3"
            />
            No team
          </>
        )}
      </span>
      <span
        role="cell"
        suppressHydrationWarning
        className="hidden w-28 items-center gap-1.5 font-mono text-xs text-ink-2 md:flex"
      >
        {lastActive === "Active now" ? (
          <span aria-hidden="true" className="size-1.5 rounded-full bg-success" />
        ) : null}
        {lastActive}
      </span>
      <span
        role="cell"
        suppressHydrationWarning
        className="hidden w-20 font-mono text-xs text-ink-3 xl:block"
      >
        {monthYear(member.createdAt)}
      </span>
      <span role="cell" className="flex w-8 justify-end">
        {canAct ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm">
                <MoreHorizontalIcon className="size-4" />
                <span className="sr-only">Open member actions</span>
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-44">
              {canManageAccess ? (
                <DropdownMenuItem
                  className="gap-2"
                  onClick={() => onManageAccess(member)}
                >
                  <ShieldIcon className="size-4" />
                  Manage access
                </DropdownMenuItem>
              ) : null}
              {canRemoveMembers ? (
                <DropdownMenuItem
                  variant="destructive"
                  className="gap-2"
                  onClick={() => onRemove(member)}
                >
                  <Trash2Icon className="size-4" />
                  Remove member
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </span>
    </div>
  );
};
