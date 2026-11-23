"use client";

import { FC, useCallback, useEffect, useState } from "react";

import { useTrpcClient } from "@zentro/api/react";
import { toastError, toastSuccess } from "@zentro/ui/index";
import { Badge } from "@zentro/ui/shadcn/badge";
import { Button } from "@zentro/ui/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@zentro/ui/shadcn/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@zentro/ui/shadcn/select";

import { usePermission } from "~/src/components/permissions/permission-provider";
import { trpcResult } from "~/src/lib/trpc-result";

import {
  MemberOverridesSection,
  type Override,
} from "./member-overrides-section";

type Props = {
  userId: string;
  name: string;
  baseRole: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type Assignment = {
  id: string;
  roleName: string;
  scopeType: string;
  scopeName: string;
};

type RoleOption = {
  id: string;
  name: string;
  scope: string;
  organizationId: string;
};

export const MemberAccessDialog: FC<Props> = ({
  userId,
  name,
  baseRole,
  open,
  onOpenChange,
}) => {
  const trpc = useTrpcClient();
  const canAssign = usePermission("roles.assign");
  const canOverride = usePermission("permissions.overrides.manage");
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [orgRoles, setOrgRoles] = useState<RoleOption[]>([]);
  const [roleId, setRoleId] = useState("");

  const load = useCallback(async () => {
    const [assignmentResult, overrideResult, roleResult] = await Promise.all([
      trpcResult(trpc.permissions.assignments.list.query({ userId })),
      trpcResult(trpc.permissions.overrides.list.query({ userId })),
      trpcResult(trpc.permissions.roles.list.query()),
    ]);

    setAssignments((assignmentResult.data ?? []) as Assignment[]);
    setOverrides((overrideResult.data ?? []) as Override[]);
    setOrgRoles(
      ((roleResult.data ?? []) as RoleOption[]).filter(
        (role) => role.scope === "organization",
      ),
    );
  }, [trpc, userId]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const run = async (
    request: Promise<unknown>,
    successMessage: string,
  ): Promise<void> => {
    const { error } = await trpcResult(request);

    if (error) {
      toastError(error.statusText, error.message);

      return;
    }

    toastSuccess(successMessage);
    await load();
  };

  const organizationId = orgRoles[0]?.organizationId ?? "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Access for {name}</DialogTitle>
          <DialogDescription>
            Base role: <Badge variant="outline">{baseRole}</Badge>. Extra roles
            add permissions; overrides allow or deny one permission.
          </DialogDescription>
        </DialogHeader>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Additional roles</h3>
          <ul className="divide-y rounded-md border">
            {assignments.length ? (
              assignments.map((assignment) => (
                <li
                  key={assignment.id}
                  className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                >
                  <span>
                    {assignment.roleName}{" "}
                    <span className="text-muted-foreground">
                      · {assignment.scopeName}
                    </span>
                  </span>
                  {canAssign ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        run(
                          trpc.permissions.assignments.unassign.mutate({
                            assignmentId: assignment.id,
                          }),
                          "Role removed",
                        )
                      }
                    >
                      Remove
                    </Button>
                  ) : null}
                </li>
              ))
            ) : (
              <li className="px-3 py-4 text-center text-sm text-muted-foreground">
                No additional roles.
              </li>
            )}
          </ul>
          {canAssign ? (
            <div className="flex gap-2">
              <Select value={roleId} onValueChange={setRoleId}>
                <SelectTrigger aria-label="Role to add">
                  <SelectValue placeholder="Add a role" />
                </SelectTrigger>
                <SelectContent>
                  {orgRoles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                disabled={!roleId}
                onClick={() =>
                  run(
                    trpc.permissions.assignments.assign.mutate({
                      roleId,
                      principalType: "user",
                      principalId: userId,
                      scopeType: "organization",
                      scopeId: organizationId,
                    }),
                    "Role assigned",
                  ).then(() => setRoleId(""))
                }
              >
                Add role
              </Button>
            </div>
          ) : null}
        </section>

        <MemberOverridesSection
          overrides={overrides}
          canOverride={canOverride}
          userId={userId}
          organizationId={organizationId}
          onRemoveOverride={(id) =>
            run(
              trpc.permissions.overrides.remove.mutate({ id }),
              "Override removed",
            )
          }
          onSaveOverride={({ permission, effect, reason }) =>
            run(
              trpc.permissions.overrides.set.mutate({
                userId,
                permission,
                effect,
                scopeType: "organization",
                scopeId: organizationId,
                reason,
              }),
              "Override saved",
            )
          }
        />
      </DialogContent>
    </Dialog>
  );
};
