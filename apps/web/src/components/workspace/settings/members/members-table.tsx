"use client";

import { cn } from "@zentro/ui/lib/utils";
import type { Member } from "~/src/lib/types";

import type { Role } from "./members-helpers";
import { MembersTableRow } from "./members-table-row";

export function MembersTable({
  membersCount,
  canInvite,
  visible,
  filtersOn,
  userId,
  extras,
  canTransfer,
  canManageAccess,
  canRemoveMembers,
  canUpdateMemberRoles,
  onRoleChange,
  onManageAccess,
  onRemove,
}: {
  membersCount: number;
  canInvite: boolean;
  visible: Member[];
  filtersOn: boolean;
  userId: string;
  extras: Record<string, { teams: string[]; lastActive: string | null }>;
  canTransfer: boolean;
  canManageAccess: boolean;
  canRemoveMembers: boolean;
  canUpdateMemberRoles: boolean;
  onRoleChange: (memberId: string, role: Role) => void;
  onManageAccess: (member: Member) => void;
  onRemove: (member: Member) => void;
}) {
  return (
    <>
      {membersCount === 1 && canInvite ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line-strong px-6 py-14 text-center">
          <p className="font-display font-semibold text-xl tracking-tight text-ink">
            Just you so far.
          </p>
          <p className="max-w-[420px] text-[15px] leading-[22px] text-ink-2">
            Invite teammates by email. They&apos;ll join with the role you pick,
            and you can change it any time.
          </p>
        </div>
      ) : null}

      <div
        role="table"
        aria-label="Members"
        className={cn(
          "flex flex-col",
          membersCount === 1 && canInvite && "hidden",
        )}
      >
        <div
          role="row"
          className="flex h-9 items-center gap-3 border-b border-hairline px-3 font-mono text-[11px] tracking-[0.08em] text-ink-3 uppercase"
        >
          <span role="columnheader" className="min-w-0 flex-1">
            Member
          </span>
          <span role="columnheader" className="w-28 sm:w-32">
            Role
          </span>
          <span role="columnheader" className="hidden w-32 lg:block">
            Team
          </span>
          <span role="columnheader" className="hidden w-28 md:block">
            Last active
          </span>
          <span role="columnheader" className="hidden w-20 xl:block">
            Joined
          </span>
          <span role="columnheader" className="w-8">
            <span className="sr-only">Actions</span>
          </span>
        </div>

        {visible.map((member) => (
          <MembersTableRow
            key={member.id}
            member={member}
            userId={userId}
            extras={extras[member.userId]}
            canTransfer={canTransfer}
            canManageAccess={canManageAccess}
            canRemoveMembers={canRemoveMembers}
            canUpdateMemberRoles={canUpdateMemberRoles}
            onRoleChange={onRoleChange}
            onManageAccess={onManageAccess}
            onRemove={onRemove}
          />
        ))}

        {visible.length === 0 && filtersOn ? (
          <p className="px-3 py-10 text-center text-sm text-ink-2">
            Nobody matches those filters.
          </p>
        ) : null}
      </div>
    </>
  );
}
