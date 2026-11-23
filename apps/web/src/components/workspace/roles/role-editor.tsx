"use client";

import { usePageCrumb } from "~/src/components/shell/breadcrumb-context";
import { FC, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeftIcon, SearchIcon } from "lucide-react";

import { useTrpcClient } from "@kyren/api/react";
import { Badge } from "@kyren/ui/shadcn/badge";
import { Button } from "@kyren/ui/shadcn/button";
import { Card, CardContent } from "@kyren/ui/shadcn/card";
import { Input } from "@kyren/ui/shadcn/input";
import { Label } from "@kyren/ui/shadcn/label";
import { Skeleton } from "@kyren/ui/shadcn/skeleton";
import { Textarea } from "@kyren/ui/shadcn/textarea";
import { toastError, toastSuccess } from "@kyren/ui/index";

import {
  useBaseRole,
  usePermission,
  usePermissionMap,
} from "~/src/components/permissions/permission-provider";
import { paths } from "~/src/lib/paths";
import { trpcResult } from "~/src/lib/trpc-result";

import { scopeLabels, useCatalog } from "./use-catalog";
import { type Role } from "./role-editor-types";
import { RolePermissionGroups } from "./role-permission-groups";

export const RoleEditor: FC<{ roleId: string }> = ({ roleId }) => {
  const trpc = useTrpcClient();
  const catalog = useCatalog();
  const myPermissions = usePermissionMap();
  const canUpdate = usePermission("roles.update");
  const [role, setRole] = useState<Role | null>(null);

  usePageCrumb(`/settings/organization/roles/${roleId}`, role?.name);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await trpcResult(
      trpc.permissions.roles.get.query({ id: roleId }),
    );

    if (error) {
      toastError(error.statusText, error.message);

      return;
    }

    const loaded = data as Role;

    setRole(loaded);
    setName(loaded.name);
    setDescription(loaded.description ?? "");
    setSelected(new Set(loaded.permissions));
  }, [roleId, trpc]);

  useEffect(() => {
    void load();
  }, [load]);

  const isBaseRole =
    role?.systemKey === "admin" || role?.systemKey === "member";
  const editableRole = role?.kind === "custom" || isBaseRole;

  const known = useMemo(
    () =>
      new Set(
        (catalog ?? [])
          .filter((entry) => !role || entry.scopes.includes(role.scope))
          .map((entry) => entry.key),
      ),
    [catalog, role],
  );
  const holdsAll = role
    ? role.permissions
        .filter((key) => known.has(key))
        .every((key) => myPermissions[key])
    : false;

  const isOwner = useBaseRole() === "owner";
  const adminRoleLocked = role?.systemKey === "admin" && !isOwner;
  const canEdit = Boolean(
    canUpdate && editableRole && holdsAll && !adminRoleLocked,
  );

  const groups = useMemo(() => {
    if (!catalog || !role) return [];

    const term = search.trim().toLowerCase();
    const visible = catalog.filter(
      (entry) =>
        entry.enabled &&
        (!term ||
          `${entry.label} ${entry.description} ${entry.key}`
            .toLowerCase()
            .includes(term)),
    );
    const byModule = new Map<string, Map<string, typeof visible>>();

    for (const entry of visible) {
      const groupsOfModule = byModule.get(entry.module) ?? new Map();
      groupsOfModule.set(entry.group, [
        ...(groupsOfModule.get(entry.group) ?? []),
        entry,
      ]);
      byModule.set(entry.module, groupsOfModule);
    }

    return [...byModule.entries()];
  }, [catalog, role, search]);

  const save = async () => {
    if (!role) return;

    setSaving(true);

    const { error } = await trpcResult(
      trpc.permissions.roles.update.mutate({
        id: role.id,
        ...(isBaseRole ? {} : { name, description }),
        permissions: [...selected].filter((key) => known.has(key)),
      }),
    );

    setSaving(false);

    if (error) {
      toastError(error.statusText, error.message);

      return;
    }

    toastSuccess("Role saved");
    await load();
  };

  const reset = async () => {
    if (!role || !isBaseRole) return;

    const { error } = await trpcResult(
      trpc.permissions.roles.resetSystem.mutate({
        systemKey: role.systemKey as "admin" | "member",
      }),
    );

    if (error) {
      toastError(error.statusText, error.message);

      return;
    }

    toastSuccess("Role reset to its defaults");
    await load();
  };

  if (!role || !catalog) {
    return <Skeleton className="h-96 w-full" />;
  }

  const dirty =
    name !== role.name ||
    description !== (role.description ?? "") ||
    selected.size !== role.permissions.length ||
    role.permissions.some((key) => !selected.has(key));

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm" className="w-fit">
        <Link href={paths.rolesSettings()}>
          <ArrowLeftIcon className="size-4" />
          All roles
        </Link>
      </Button>

      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-display text-2xl text-ink">{role.name}</h2>
        {role.kind === "system" ? (
          <Badge variant="secondary">System</Badge>
        ) : null}
        <Badge variant="outline">{scopeLabels[role.scope]} role</Badge>
      </div>

      {role.systemKey === "owner" ? (
        <p className="text-sm text-muted-foreground">
          Owner always has every permission and cannot be changed.
        </p>
      ) : !editableRole ? (
        <p className="text-sm text-muted-foreground">
          This system role cannot be changed.
        </p>
      ) : !canUpdate ? (
        <p className="text-sm text-muted-foreground">
          You can view this role but not change it.
        </p>
      ) : adminRoleLocked ? (
        <p className="text-sm text-muted-foreground">
          Only the owner can change the Admin role, since it is every
          admin&apos;s access.
        </p>
      ) : !holdsAll ? (
        <p className="text-sm text-muted-foreground">
          This role grants permissions you do not hold yourself, so you cannot
          edit it.
        </p>
      ) : null}

      {!isBaseRole && role.kind === "custom" ? (
        <Card>
          <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="role-title">Name</Label>
              <Input
                id="role-title"
                value={name}
                disabled={!canEdit}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role-description">Description</Label>
              <Textarea
                id="role-description"
                rows={2}
                value={description}
                disabled={!canEdit}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="Search permissions"
          placeholder="Search permissions"
          className="pl-9"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <RolePermissionGroups
        groups={groups}
        role={role}
        myPermissions={myPermissions}
        selected={selected}
        canEdit={canEdit}
        onToggle={(key, checked) =>
          setSelected((current) => {
            const next = new Set(current);

            if (checked) next.add(key);
            else next.delete(key);

            return next;
          })
        }
      />

      {canEdit ? (
        <div className="flex flex-wrap gap-2">
          <Button disabled={!dirty || saving} onClick={save}>
            Save changes
          </Button>
          {isBaseRole ? (
            <Button variant="outline" onClick={reset}>
              Reset to default
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
