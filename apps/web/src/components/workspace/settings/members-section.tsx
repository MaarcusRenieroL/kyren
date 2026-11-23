"use client";

import { FC, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircleIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { useTrpcClient } from "@kyren/api/react";
import { Button } from "@kyren/ui/components/shadcn/button";
import { toastError, toastSuccess } from "@kyren/ui/index";

import { MemberAccessDialog } from "~/src/components/workspace/roles/member-access-dialog";
import {
  useAnyPermission,
  usePermission,
} from "~/src/components/permissions/permission-provider";
import { paths } from "~/src/lib/paths";
import { trpcResult } from "~/src/lib/trpc-result";
import { Member } from "~/src/lib/types";

import { PAGE_SIZE, type Role } from "./members/members-helpers";
import { MembersFilterBar } from "./members/members-filter-bar";
import { MembersTable } from "./members/members-table";
import { RemoveMemberDialog } from "./members/remove-member-dialog";
import { SettingsHeader } from "./settings-kit";

export { shortAgo } from "./members/members-helpers";

type Props = {
  members: Member[];
  extras?: Record<string, { teams: string[]; lastActive: string | null }>;
  userId: string;
  permissions: {
    canRemoveMembers: boolean;
    canUpdateMemberRoles: boolean;
  };
};

export const MembersSection: FC<Props> = ({
  members: initialMembers,
  userId,
  permissions,
  extras = {},
}) => {
  const canInvite = usePermission("members.invite");
  const canTransfer = usePermission("org.ownership.transfer");
  const [members, setMembers] = useState(initialMembers);
  const [memberToRemove, setMemberToRemove] = useState<Member | null>(null);
  const [accessMember, setAccessMember] = useState<Member | null>(null);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [teamFilter, setTeamFilter] = useState("all");
  const [page, setPage] = useState(0);
  const canManageAccess = useAnyPermission([
    "roles.assign",
    "permissions.overrides.manage",
  ]);

  const router = useRouter();
  const trpc = useTrpcClient();

  const currentUser = members.find((member) => member.userId === userId);
  const ownerCount = members.filter((member) => member.role === "owner").length;
  const teamNames = [
    ...new Set(Object.values(extras).flatMap((entry) => entry.teams)),
  ].sort();

  const needle = query.trim().toLowerCase();
  const filtered = members.filter((member) => {
    const teams = extras[member.userId]?.teams ?? [];

    if (
      needle &&
      !member.user.name.toLowerCase().includes(needle) &&
      !member.user.email.toLowerCase().includes(needle)
    ) {
      return false;
    }
    if (roleFilter !== "all" && member.role !== roleFilter) return false;
    if (teamFilter === "none") return teams.length === 0;
    if (teamFilter !== "all" && !teams.includes(teamFilter)) return false;

    return true;
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const visible = filtered.slice(
    current * PAGE_SIZE,
    (current + 1) * PAGE_SIZE,
  );

  const handleRoleChange = async (memberId: string, role: Role) => {
    const previous = members.find((member) => member.id === memberId)?.role;

    setMembers((currentMembers) =>
      currentMembers.map((member) =>
        member.id === memberId ? { ...member, role } : member,
      ),
    );

    const { error } = await trpcResult(
      trpc.member.updateRole.mutate({
        memberId,
        role: role === "owner" ? "admin" : role,
      }),
    );

    if (error) {
      if (previous) {
        setMembers((currentMembers) =>
          currentMembers.map((member) =>
            member.id === memberId ? { ...member, role: previous } : member,
          ),
        );
      }
      toastError(error.statusText, error.message);
      return;
    }

    toastSuccess("Role changed", "Their access updates right away.");
    router.refresh();
  };

  const handleRemoveMember = async () => {
    if (!memberToRemove) return;

    const { error } = await trpcResult(
      trpc.member.remove.mutate({ memberId: memberToRemove.id }),
    );

    if (error) {
      toastError(error.statusText, error.message);
      return;
    }

    toastSuccess(
      "Member removed",
      `${memberToRemove.user.name} no longer has access.`,
    );
    router.refresh();
  };

  const filtersOn =
    Boolean(needle) || roleFilter !== "all" || teamFilter !== "all";

  return (
    <div className="flex flex-col gap-5">
      <SettingsHeader
        eyebrow="ORGANIZATION"
        title="Members"
        description="Everyone in this organization, their role and when they were last around."
      />

      {ownerCount === 1 && currentUser?.role === "owner" ? (
        <div className="flex flex-col gap-2 rounded-md border border-warning/40 bg-warning-subtle px-4 py-3 sm:flex-row sm:items-center sm:gap-3">
          <AlertCircleIcon
            aria-hidden="true"
            className="size-5 shrink-0 text-warning-text"
          />
          <p className="flex-1 text-sm text-ink-2">
            <span className="font-semibold text-ink">
              You&apos;re the only owner.
            </span>{" "}
            If you leave, nobody can delete the organization or hand it on.
          </p>
          {canTransfer ? (
            <Link
              href={paths.dangerSettings()}
              className="text-sm font-medium whitespace-nowrap text-signal-strong hover:underline"
            >
              Transfer ownership
            </Link>
          ) : null}
        </div>
      ) : null}

      <MembersFilterBar
        query={query}
        setQuery={(q) => {
          setQuery(q);
          setPage(0);
        }}
        roleFilter={roleFilter}
        setRoleFilter={(r) => {
          setRoleFilter(r);
          setPage(0);
        }}
        teamFilter={teamFilter}
        setTeamFilter={(t) => {
          setTeamFilter(t);
          setPage(0);
        }}
        teamNames={teamNames}
        filteredCount={filtered.length}
      />

      <MembersTable
        membersCount={members.length}
        canInvite={canInvite}
        visible={visible}
        filtersOn={filtersOn}
        userId={userId}
        extras={extras}
        canTransfer={canTransfer}
        canManageAccess={canManageAccess}
        canRemoveMembers={permissions.canRemoveMembers}
        canUpdateMemberRoles={permissions.canUpdateMemberRoles}
        onRoleChange={handleRoleChange}
        onManageAccess={setAccessMember}
        onRemove={setMemberToRemove}
      />

      {filtered.length > PAGE_SIZE ? (
        <div className="flex items-center gap-2">
          <span className="flex-1 font-mono text-xs text-ink-3">
            {current * PAGE_SIZE + 1}–
            {Math.min((current + 1) * PAGE_SIZE, filtered.length)} of{" "}
            {filtered.length}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={current === 0}
            onClick={() => setPage(current - 1)}
          >
            <ChevronLeftIcon />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={current >= pageCount - 1}
            onClick={() => setPage(current + 1)}
          >
            Next
            <ChevronRightIcon />
          </Button>
        </div>
      ) : null}

      {accessMember ? (
        <MemberAccessDialog
          userId={accessMember.userId}
          name={accessMember.user.name}
          baseRole={accessMember.role}
          open
          onOpenChange={(open) => {
            if (!open) setAccessMember(null);
          }}
        />
      ) : null}

      <RemoveMemberDialog
        member={memberToRemove}
        onClose={() => setMemberToRemove(null)}
        onConfirm={handleRemoveMember}
      />
    </div>
  );
};
