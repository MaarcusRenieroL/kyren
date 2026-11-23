"use client";

import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@zentro/ui/shadcn/table";
import { useState } from "react";

import { useTrpcClient } from "@zentro/api/react";
import { Button } from "@zentro/ui/shadcn/button";
import { Input } from "@zentro/ui/shadcn/input";

import { useAsyncData } from "~/src/lib/use-async-data";
import { useDebounced } from "~/src/lib/use-debounced";
import {
  Failed,
  Title,
  cell,
  formatDate,
  headCell,
  tableClass,
} from "./common";

export function PlatformAudit() {
  const trpc = useTrpcClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const term = useDebounced(search, 250);
  const trail = useAsyncData(
    () => trpc.platform.audit.list.query({ search: term, page }),
    [term, page],
  );

  return (
    <>
      <Title
        title="Audit trail"
        description="Everything platform operators did, including each look inside a tenant. It cannot be edited and outlives the tenants it names."
      />
      <Input
        aria-label="Search the trail"
        placeholder="Search by action, operator or name"
        className="w-72"
        value={search}
        onChange={(event) => {
          setSearch(event.target.value);
          setPage(1);
        }}
      />
      {trail.status === "error" ? <Failed error={trail.error} /> : null}
      {trail.data ? (
        <>
          <Table className={tableClass}>
            <TableHeader>
              <TableRow>
                <TableHead className={headCell}>When</TableHead>
                <TableHead className={headCell}>Operator</TableHead>
                <TableHead className={headCell}>Action</TableHead>
                <TableHead className={headCell}>Target</TableHead>
                <TableHead className={headCell}>Detail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trail.data.rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className={cell}>
                    {formatDate(row.createdAt)}
                  </TableCell>
                  <TableCell className={cell}>
                    {row.actorEmail}
                    {row.ip ? (
                      <div className="font-mono text-xs text-ink-2">
                        {row.ip}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className={`${cell} font-mono text-xs`}>
                    {row.action}
                  </TableCell>
                  <TableCell className={cell}>
                    {row.label || row.targetType}
                  </TableCell>
                  <TableCell className={`${cell} font-mono text-xs text-ink-2`}>
                    {Object.keys(row.detail).length
                      ? JSON.stringify(row.detail)
                      : ""}
                  </TableCell>
                </TableRow>
              ))}
              {!trail.data.rows.length ? (
                <TableRow>
                  <TableCell className={cell} colSpan={5}>
                    Nothing recorded.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
          <div className="flex items-center gap-3 text-sm text-ink-2">
            <span>{trail.data.total} entries</span>
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page * trail.data.pageSize >= trail.data.total}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </>
      ) : null}
    </>
  );
}
