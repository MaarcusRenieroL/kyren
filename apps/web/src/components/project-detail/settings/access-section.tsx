"use client";

import { FC, useCallback, useEffect, useState } from "react";
import { useTrpcClient } from "@zentro/api/react";
import { toastError, toastSuccess } from "@zentro/ui/index";
import { Button } from "@zentro/ui/shadcn/button";
import { Skeleton } from "@zentro/ui/shadcn/skeleton";
import { usePermission } from "~/src/components/permissions/permission-provider";
import { trpcResult } from "~/src/lib/trpc-result";

import { noTeam, type Access, type Option, type Visibility } from "./access/types";
import { VisibilityPicker } from "./access/visibility-picker";
import { AssignmentsList } from "./access/assignments-list";

export const ProjectAccessSection: FC<{ slug: string }> = ({ slug }) => {
  const trpc = useTrpcClient();
  const [access, setAccess] = useState<Access | null>(null);
  const [visibility, setVisibility] = useState<Visibility>("organization");
  const [teamId, setTeamId] = useState(noTeam);
  const [people, setPeople] = useState<Option[]>([]);
  const [teamOptions, setTeamOptions] = useState<Option[]>([]);
  const [principal, setPrincipal] = useState("");
  const [roleId, setRoleId] = useState("");
  const [adding, setAdding] = useState(false);

  const canManage = usePermission("projects.settings.manage", {
    projectId: access?.projectId,
  });
  const canAssign = usePermission("projects.members.manage", {
    projectId: access?.projectId,
  });

  const load = useCallback(async () => {
    const { data, error } = await trpcResult(
      trpc.project.getAccess.query({ slug }),
    );

    if (error) {
      toastError(error.statusText, error.message);
      return;
    }

    setAccess(data as Access);
    setVisibility(data.visibility as Visibility);
    setTeamId(data.teamId ?? noTeam);
  }, [trpc, slug]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void Promise.all([
      trpcResult(trpc.member.getMembers.query()),
      trpcResult(trpc.team.getAll.query()),
    ]).then(([members, teamList]) => {
      setPeople(
        (members.data ?? []).map((member) => ({
          id: `user:${member.userId}`,
          label: member.name || member.email,
        })),
      );
      setTeamOptions(
        (teamList.data ?? []).map((team) => ({
          id: team.id,
          label: team.name,
        })),
      );
    });
  }, [trpc]);

  if (!access) {
    return <Skeleton className="h-64 w-full" />;
  }

  const saveVisibility = async () => {
    const { error } = await trpcResult(
      trpc.project.updateAccess.mutate({
        slug,
        visibility,
        teamId: teamId === noTeam ? null : teamId,
      }),
    );

    if (error) {
      toastError(error.statusText, error.message);
      return;
    }

    toastSuccess("Project access updated");
    await load();
  };

  const assign = async () => {
    const [type, id] = principal.split(":") as ["user" | "team", string];
    const { error } = await trpcResult(
      trpc.permissions.assignments.assign.mutate({
        roleId,
        principalType: type,
        principalId: id,
        scopeType: "project",
        scopeId: access.projectId,
      }),
    );

    if (error) {
      toastError(error.statusText, error.message);
      return;
    }

    toastSuccess("Role assigned");
    setPrincipal("");
    setAdding(false);
    await load();
  };

  const unassign = async (assignmentId: string) => {
    const { error } = await trpcResult(
      trpc.permissions.assignments.unassign.mutate({ assignmentId }),
    );

    if (error) {
      toastError(error.statusText, error.message);
      return;
    }

    toastSuccess("Role removed");
    await load();
  };

  const changeRole = async (
    assignment: Access["assignments"][number],
    nextRoleId: string,
  ) => {
    if (nextRoleId === assignment.roleId) return;

    const added = await trpcResult(
      trpc.permissions.assignments.assign.mutate({
        roleId: nextRoleId,
        principalType: assignment.principalType,
        principalId: assignment.principalId,
        scopeType: "project",
        scopeId: access.projectId,
      }),
    );

    if (added.error) {
      toastError(added.error.statusText, added.error.message);
      return;
    }

    const removed = await trpcResult(
      trpc.permissions.assignments.unassign.mutate({
        assignmentId: assignment.id,
      }),
    );

    if (removed.error) {
      toastError(removed.error.statusText, removed.error.message);
    } else {
      toastSuccess("Role changed");
    }

    await load();
  };

  const visibilityChanged =
    visibility !== access.visibility ||
    (teamId === noTeam ? null : teamId) !== access.teamId;

  return (
    <div className="flex max-w-[860px] flex-col gap-7">
      <VisibilityPicker
        visibility={visibility}
        onVisibilityChange={setVisibility}
        teamId={teamId}
        onTeamIdChange={setTeamId}
        teamOptions={teamOptions}
        canManage={canManage}
      />

      {canManage && visibilityChanged ? (
        <div
          role="status"
          className="flex flex-wrap items-center gap-2.5 rounded-xl border border-hairline bg-overlay py-2.5 pr-2.5 pl-4 shadow-lg motion-safe:animate-fade-up"
        >
          <span
            aria-hidden="true"
            className="size-2 rounded-full bg-status-progress"
          />
          <span className="text-sm">You changed who can see this project.</span>
          <span className="flex-1" />
          <Button
            variant="outline"
            onClick={() => {
              setVisibility(access.visibility);
              setTeamId(access.teamId ?? noTeam);
            }}
            className="h-9 border-hairline bg-transparent px-3"
          >
            Discard
          </Button>
          <Button onClick={saveVisibility} className="h-9 px-3 font-semibold">
            Save visibility
          </Button>
        </div>
      ) : null}

      <AssignmentsList
        access={access}
        canAssign={canAssign}
        adding={adding}
        onToggleAdding={() => setAdding((value) => !value)}
        principal={principal}
        onPrincipalChange={setPrincipal}
        roleId={roleId}
        onRoleIdChange={setRoleId}
        people={people}
        teamOptions={teamOptions}
        onAssign={assign}
        onUnassign={unassign}
        onChangeRole={changeRole}
      />
    </div>
  );
};
