"use client";

import { FC, useCallback, useEffect, useState } from "react";
import { Trash2Icon } from "lucide-react";

import { useTrpcClient } from "@zentro/api/react";
import { Button } from "@zentro/ui/shadcn/button";
import { Card, CardContent } from "@zentro/ui/shadcn/card";
import { Skeleton } from "@zentro/ui/shadcn/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@zentro/ui/shadcn/table";
import { toastError, toastSuccess } from "@zentro/ui/index";

import { usePermission } from "~/src/components/permissions/permission-provider";
import { trpcResult } from "~/src/lib/trpc-result";

import { scopeLabels } from "./use-catalog";
import type { AssignmentRow, Option, RoleOption } from "./assignments-types";
import { AssignRoleCard } from "./assign-role-card";

export const AssignmentsView: FC = () => {
  const trpc = useTrpcClient();
  const canAssign = usePermission("roles.assign");
  const [rows, setRows] = useState<AssignmentRow[] | null>(null);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [people, setPeople] = useState<Option[]>([]);
  const [teams, setTeams] = useState<Option[]>([]);
  const [projects, setProjects] = useState<Option[]>([]);

  const [roleId, setRoleId] = useState("");
  const [principalType, setPrincipalType] = useState<"user" | "team">("user");
  const [principalId, setPrincipalId] = useState("");
  const [scopeId, setScopeId] = useState("");
  const [organizationId, setOrganizationId] = useState("");

  const load = useCallback(async () => {
    const [assignments, roleList, memberList, teamList, projectList] =
      await Promise.all([
        trpcResult(trpc.permissions.assignments.list.query()),
        trpcResult(trpc.permissions.roles.list.query()),
        trpcResult(trpc.member.getMembers.query()),
        trpcResult(trpc.team.getAll.query()),
        trpcResult(trpc.project.getProjectsByOrgId.query()),
      ]);

    setRows((assignments.data ?? []) as AssignmentRow[]);
    setRoles(
      ((roleList.data ?? []) as RoleOption[]).filter(
        (role) => !["owner", "admin", "member"].includes(role.systemKey ?? ""),
      ),
    );
    setPeople(
      (memberList.data ?? []).map((member) => ({
        id: member.userId,
        label: member.name || member.email,
      })),
    );
    setTeams(
      (teamList.data ?? []).map((team) => ({ id: team.id, label: team.name })),
    );
    setProjects(
      (projectList.data ?? []).map((project) => ({
        id: project.id,
        label: project.name,
      })),
    );
    setOrganizationId(roleList.data?.[0]?.organizationId ?? "");
  }, [trpc]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedRole = roles.find((role) => role.id === roleId);

  const assign = async () => {
    if (!selectedRole) return;

    const resolvedScopeId =
      selectedRole.scope === "organization" ? organizationId : scopeId;

    const { error } = await trpcResult(
      trpc.permissions.assignments.assign.mutate({
        roleId,
        principalType,
        principalId,
        scopeType: selectedRole.scope as "organization" | "team" | "project",
        scopeId: resolvedScopeId,
      }),
    );

    if (error) {
      toastError(error.statusText, error.message);

      return;
    }

    toastSuccess("Role assigned");
    await load();
  };

  const unassign = async (id: string) => {
    const { error } = await trpcResult(
      trpc.permissions.assignments.unassign.mutate({ assignmentId: id }),
    );

    if (error) {
      toastError(error.statusText, error.message);

      return;
    }

    toastSuccess("Assignment removed");
    await load();
  };

  if (!rows) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[15px] text-ink-2">
          Who has which role, and where. Base roles (Owner, Admin, Member) are
          set on the members page.
        </p>
      </div>

      {canAssign ? (
        <AssignRoleCard
          roles={roles}
          roleId={roleId}
          setRoleId={setRoleId}
          principalType={principalType}
          setPrincipalType={setPrincipalType}
          principalId={principalId}
          setPrincipalId={setPrincipalId}
          scopeId={scopeId}
          setScopeId={setScopeId}
          people={people}
          teams={teams}
          projects={projects}
          onAssign={assign}
        />
      ) : null}

      <Card className="py-0">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Who</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Where</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length ? (
                rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      {row.principalName}{" "}
                      <span className="text-xs text-muted-foreground">
                        ({row.principalType === "team" ? "team" : "member"})
                      </span>
                    </TableCell>
                    <TableCell>{row.roleName}</TableCell>
                    <TableCell>
                      {scopeLabels[row.scopeType]}: {row.scopeName}
                    </TableCell>
                    <TableCell className="text-right">
                      {canAssign ? (
                        <Button
                          variant="outline"
                          size="icon-sm"
                          aria-label={`Remove ${row.roleName} from ${row.principalName}`}
                          onClick={() => unassign(row.id)}
                        >
                          <Trash2Icon className="size-4" />
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    No role assignments yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
