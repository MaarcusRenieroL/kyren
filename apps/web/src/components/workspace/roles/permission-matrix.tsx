"use client";

import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@kyren/ui/shadcn/table";
import { CheckIcon, LockIcon } from "lucide-react";
import { useMemo, type FC } from "react";

import { listModules } from "@kyren/modules";
import { Skeleton } from "@kyren/ui/shadcn/skeleton";

import { roleOrder, useCatalog } from "./use-catalog";

type Role = {
  id: string;
  name: string;
  scope: string;
  systemKey: string | null;
  permissions: string[];
};

const moduleNames: Record<string, string> = {
  platform: "Platform",
  ...Object.fromEntries(
    listModules().map((module) => [module.id, module.name]),
  ),
};

/** Who can do what: a check where a role grants it, a dim dash where it does not. */
export const PermissionMatrix: FC<{ roles: Role[] }> = ({ roles }) => {
  const catalog = useCatalog();
  const columns = roles
    .filter((role) => role.scope === "organization")
    .sort(roleOrder);
  const rows = useMemo(
    () =>
      (catalog ?? [])
        .filter((entry) => entry.scopes.includes("organization"))
        .sort(
          (a, b) =>
            a.module.localeCompare(b.module) || a.group.localeCompare(b.group),
        ),
    [catalog],
  );

  if (!catalog) return <Skeleton className="h-64 w-full rounded-xl" />;

  return (
    <section aria-labelledby="matrix-title" className="flex flex-col gap-3">
      <h2 id="matrix-title" className="flex flex-wrap items-baseline gap-x-2.5">
        <span className="font-semibold">Permission matrix</span>
        <span className="text-sm text-ink-3">
          What each role can do across every module
        </span>
      </h2>
      <div className="tile overflow-x-auto">
        <Table className="w-full min-w-[32rem] border-collapse text-sm">
          <TableHeader>
            <TableRow className="border-b border-hairline">
              <TableHead
                scope="col"
                className="px-(--pad-tile) py-3.5 text-left font-mono text-[11px] font-normal tracking-[0.08em] text-ink-3 uppercase"
              >
                Permission
              </TableHead>
              {columns.map((role) => (
                <TableHead
                  key={role.id}
                  scope="col"
                  className="px-3 py-3.5 text-center font-medium text-ink"
                >
                  {role.name}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((entry, index) => {
              const showModule =
                index === 0 || rows[index - 1]!.module !== entry.module;

              return [
                showModule ? (
                  <TableRow
                    key={`m-${entry.module}`}
                    className="border-b border-hairline"
                  >
                    <TableHead
                      colSpan={columns.length + 1}
                      scope="colgroup"
                      className="eyebrow px-(--pad-tile) pt-4 pb-2 text-left"
                    >
                      {moduleNames[entry.module] ?? entry.module}
                    </TableHead>
                  </TableRow>
                ) : null,
                <TableRow
                  key={entry.key}
                  className="border-b border-hairline last:border-b-0 hover:bg-hover"
                >
                  <TableHead
                    scope="row"
                    className="px-(--pad-tile) py-2.5 text-left font-normal text-ink"
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      {entry.label}
                      {entry.ownerOnly ? (
                        <span className="inline-flex items-center gap-1 rounded-xs border border-hairline px-1.5 font-mono text-[10px] tracking-[0.04em] text-ink-2 uppercase">
                          <LockIcon className="size-2.5" aria-hidden="true" />
                          Owner only
                        </span>
                      ) : null}
                    </span>
                  </TableHead>
                  {columns.map((role) => {
                    const granted =
                      role.systemKey === "owner" ||
                      role.permissions.includes(entry.key);

                    return (
                      <TableCell
                        key={role.id}
                        className="px-3 py-2.5 text-center"
                      >
                        {granted ? (
                          <>
                            <CheckIcon
                              className="mx-auto size-4 text-ink"
                              aria-hidden="true"
                            />
                            <span className="sr-only">Allowed</span>
                          </>
                        ) : (
                          <>
                            <span
                              aria-hidden="true"
                              className="font-mono text-ink-disabled"
                            >
                              –
                            </span>
                            <span className="sr-only">Not allowed</span>
                          </>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>,
              ];
            })}
          </TableBody>
        </Table>
      </div>
    </section>
  );
};
