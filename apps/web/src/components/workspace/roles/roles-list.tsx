"use client";

import { FC, useCallback, useEffect, useState } from "react";
import { PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";

import { useTrpcClient } from "@zentro/api/react";
import { Button } from "@zentro/ui/shadcn/button";
import { Skeleton } from "@zentro/ui/shadcn/skeleton";
import { toastError, toastSuccess } from "@zentro/ui/index";

import { usePermission } from "~/src/components/permissions/permission-provider";
import { useFrameAction } from "~/src/components/workspace/settings/frames";
import { paths } from "~/src/lib/paths";
import { trpcResult } from "~/src/lib/trpc-result";

import { PermissionMatrix } from "./permission-matrix";
import { roleOrder, useCatalog } from "./use-catalog";
import type { RoleRow } from "./roles-list/types";
import {
  CloneRoleDialog,
  CreateRoleDialog,
  DeleteRoleDialog,
} from "./roles-list/roles-dialogs";
import { RolesTableRow } from "./roles-list/roles-table-row";

export const RolesList: FC = () => {
  const trpc = useTrpcClient();
  const router = useRouter();
  const [roles, setRoles] = useState<RoleRow[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [cloning, setCloning] = useState<RoleRow | null>(null);
  const [deleting, setDeleting] = useState<RoleRow | null>(null);
  const [name, setName] = useState("");
  const [scope, setScope] = useState<"organization" | "team" | "project">(
    "organization",
  );

  const catalog = useCatalog();
  const [members, setMembers] = useState<
    Array<{ userId: string; name: string; role: string }>
  >([]);
  const canCreate = usePermission("roles.create");
  const canUpdate = usePermission("roles.update");
  const canDelete = usePermission("roles.delete");

  const load = useCallback(async () => {
    const { data, error } = await trpcResult(
      trpc.permissions.roles.list.query(),
    );

    if (error) {
      toastError(error.statusText, error.message);
      setRoles([]);
      return;
    }

    setRoles([...(data as RoleRow[])].sort(roleOrder));
  }, [trpc]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    trpc.member.getMembers
      .query()
      .then((list) =>
        setMembers(
          list.map((member) => ({
            userId: member.userId,
            name: member.name,
            role: member.role,
          })),
        ),
      )
      .catch(() => setMembers([]));
  }, [trpc]);

  const createRole = async () => {
    const { data, error } = await trpcResult(
      trpc.permissions.roles.create.mutate({ name, scope, permissions: [] }),
    );

    if (error) {
      toastError(error.statusText, error.message);
      return;
    }

    toastSuccess("Role created");
    setCreating(false);
    setName("");
    router.push(paths.role(data.id));
  };

  const cloneRole = async () => {
    if (!cloning) return;

    const { data, error } = await trpcResult(
      trpc.permissions.roles.clone.mutate({ id: cloning.id, name }),
    );

    if (error) {
      toastError(error.statusText, error.message);
      return;
    }

    toastSuccess("Role cloned");
    setCloning(null);
    setName("");
    router.push(paths.role(data.id));
  };

  const deleteRole = async () => {
    if (!deleting) return;

    const { error } = await trpcResult(
      trpc.permissions.roles.delete.mutate({ id: deleting.id }),
    );

    if (error) {
      toastError(error.statusText, error.message);
      return;
    }

    toastSuccess("Role deleted");
    setDeleting(null);
    await load();
  };

  const startCreate = () => setCreating(true);
  const framedAction = useFrameAction(
    canCreate ? "New role" : null,
    startCreate,
  );

  if (!roles) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  const keysFor = (roleScope: string) =>
    new Set(
      (catalog ?? [])
        .filter((entry) => entry.scopes.includes(roleScope))
        .map((entry) => entry.key),
    );
  const totalFor = (roleScope: string) => keysFor(roleScope).size;
  const peopleFor = (role: RoleRow) =>
    role.systemKey === "owner" ||
    role.systemKey === "admin" ||
    role.systemKey === "member"
      ? members.filter((member) => member.role === role.systemKey)
      : null;

  return (
    <div className="flex flex-col gap-8">
      {!framedAction && canCreate ? (
        <div className="flex justify-end">
          <Button onClick={startCreate}>
            <PlusIcon className="size-4" />
            New role
          </Button>
        </div>
      ) : null}

      <div role="table" aria-label="Roles" className="flex flex-col">
        <div
          role="row"
          className="flex h-9 items-center gap-3 border-b border-hairline px-3 font-mono text-[11px] tracking-[0.08em] text-ink-3 uppercase"
        >
          <span role="columnheader" className="min-w-0 flex-1">
            Role
          </span>
          <span role="columnheader" className="hidden w-36 sm:block">
            People
          </span>
          <span role="columnheader" className="w-24 text-right">
            Permissions
          </span>
          <span role="columnheader" className="w-8">
            <span className="sr-only">Actions</span>
          </span>
        </div>
        {roles.map((role) => {
          const people = peopleFor(role);
          const total = totalFor(role.scope);
          const known = keysFor(role.scope);
          const granted =
            role.systemKey === "owner"
              ? total
              : role.permissions.filter((key) => known.has(key)).length;

          return (
            <RolesTableRow
              key={role.id}
              role={role}
              people={people}
              total={total}
              granted={granted}
              canCreate={canCreate}
              canUpdate={canUpdate}
              canDelete={canDelete}
              onStartClone={(r) => {
                setCloning(r);
                setName(`${r.name} copy`);
              }}
              onStartDelete={(r) => setDeleting(r)}
            />
          );
        })}
      </div>

      <PermissionMatrix roles={roles} />

      <CreateRoleDialog
        open={creating}
        onOpenChange={setCreating}
        name={name}
        onNameChange={setName}
        scope={scope}
        onScopeChange={setScope}
        onCreate={createRole}
      />

      <CloneRoleDialog
        cloning={cloning}
        onClose={() => setCloning(null)}
        name={name}
        onNameChange={setName}
        onClone={cloneRole}
      />

      <DeleteRoleDialog
        deleting={deleting}
        onClose={() => setDeleting(null)}
        onDelete={deleteRole}
      />
    </div>
  );
};
