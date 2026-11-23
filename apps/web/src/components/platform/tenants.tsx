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
import Link from "next/link";

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

const filters = [
  ["all", "All"],
  ["active", "Active"],
  ["suspended", "Suspended"],
  ["deleting", "Deleting"],
] as const;

export function Tenants() {
  const trpc = useTrpcClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<(typeof filters)[number][0]>("all");
  const [page, setPage] = useState(1);
  const term = useDebounced(search, 250);
  const list = useAsyncData(
    () => trpc.platform.tenants.list.query({ search: term, status, page }),
    [term, status, page],
  );
  const data = list.data;

  return (
    <>
      <Title
        title="Tenants"
        description="Every organization on Zentro. Open one to suspend it, set limits, look inside or schedule its deletion."
      />
      <div className="flex flex-wrap items-center gap-2">
        <Input
          aria-label="Search organizations"
          placeholder="Search by name or slug"
          className="w-64"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
        {filters.map(([value, label]) => (
          <Button
            key={value}
            size="sm"
            variant={status === value ? "default" : "outline"}
            onClick={() => {
              setStatus(value);
              setPage(1);
            }}
          >
            {label}
          </Button>
        ))}
      </div>

      {list.status === "error" ? <Failed error={list.error} /> : null}
      {list.status === "loading" ? (
        <p className="text-sm text-ink-2">Loading…</p>
      ) : null}

      {data ? (
        <>
          <Table className={tableClass}>
            <TableHeader>
              <TableRow>
                <TableHead className={headCell}>Organization</TableHead>
                <TableHead className={headCell}>Members</TableHead>
                <TableHead className={headCell}>Created</TableHead>
                <TableHead className={headCell}>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className={cell}>
                    <Link
                      href={`/platform/tenants/${row.id}`}
                      className="font-medium text-ink underline-offset-2 hover:underline"
                    >
                      {row.name}
                    </Link>
                    <div className="font-mono text-xs text-ink-2">
                      {row.slug}
                    </div>
                  </TableCell>
                  <TableCell className={cell}>{row.members}</TableCell>
                  <TableCell className={cell}>
                    {formatDate(row.createdAt)}
                  </TableCell>
                  <TableCell className={cell}>
                    {row.deletionScheduledFor
                      ? `Deleting ${formatDate(row.deletionScheduledFor)}`
                      : row.suspendedAt
                        ? "Suspended"
                        : "Active"}
                  </TableCell>
                </TableRow>
              ))}
              {!data.rows.length ? (
                <TableRow>
                  <TableCell className={cell} colSpan={4}>
                    No organizations match.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
          <div className="flex items-center gap-3 text-sm text-ink-2">
            <span>
              {data.total} {data.total === 1 ? "organization" : "organizations"}
            </span>
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
              disabled={page * data.pageSize >= data.total}
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
