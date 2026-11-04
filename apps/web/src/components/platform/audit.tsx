"use client";

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
          <table className={tableClass}>
            <thead>
              <tr>
                <th className={headCell}>When</th>
                <th className={headCell}>Operator</th>
                <th className={headCell}>Action</th>
                <th className={headCell}>Target</th>
                <th className={headCell}>Detail</th>
              </tr>
            </thead>
            <tbody>
              {trail.data.rows.map((row) => (
                <tr key={row.id}>
                  <td className={cell}>{formatDate(row.createdAt)}</td>
                  <td className={cell}>
                    {row.actorEmail}
                    {row.ip ? (
                      <div className="font-mono text-xs text-ink-2">
                        {row.ip}
                      </div>
                    ) : null}
                  </td>
                  <td className={`${cell} font-mono text-xs`}>{row.action}</td>
                  <td className={cell}>{row.label || row.targetType}</td>
                  <td className={`${cell} font-mono text-xs text-ink-2`}>
                    {Object.keys(row.detail).length
                      ? JSON.stringify(row.detail)
                      : ""}
                  </td>
                </tr>
              ))}
              {!trail.data.rows.length ? (
                <tr>
                  <td className={cell} colSpan={5}>
                    Nothing recorded.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
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
