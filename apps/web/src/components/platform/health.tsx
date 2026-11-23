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
import { toastError, toastSuccess } from "@zentro/ui/index";
import { Button } from "@zentro/ui/shadcn/button";

import { useAsyncData } from "~/src/lib/use-async-data";
import {
  Failed,
  Title,
  cell,
  formatDate,
  headCell,
  tableClass,
} from "./common";

export function Health() {
  const trpc = useTrpcClient();
  const health = useAsyncData(() => trpc.platform.health.overview.query(), []);
  const [busy, setBusy] = useState(false);

  async function act(work: () => Promise<unknown>, done: string) {
    setBusy(true);

    try {
      await work();
      toastSuccess(done);
      health.reload();
    } catch (error) {
      toastError(error, "That did not work.");
    } finally {
      setBusy(false);
    }
  }

  if (health.status === "error") return <Failed error={health.error} />;

  const data = health.data;

  return (
    <>
      <Title
        title="Health"
        description="Background work and the database. Failed jobs ran out of retries and wait for you."
        actions={
          <Button size="sm" variant="outline" onClick={() => health.reload()}>
            Refresh
          </Button>
        }
      />
      {!data ? <p className="text-sm text-ink-2">Loading…</p> : null}
      {data ? (
        <>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            {[
              ["Database", `${data.databaseMs} ms`],
              [
                "Tenants",
                `${data.tenants} (${data.suspendedTenants} suspended)`,
              ],
              ["Users", String(data.users)],
              ["Failed jobs", String(data.dead.length)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-line p-3">
                <dt className="text-ink-2">{label}</dt>
                <dd className="text-lg">{value}</dd>
              </div>
            ))}
          </dl>

          <h2 className="text-sm font-semibold">Job queue</h2>
          <Table className={tableClass}>
            <TableHeader>
              <TableRow>
                <TableHead className={headCell}>Kind</TableHead>
                <TableHead className={headCell}>Status</TableHead>
                <TableHead className={headCell}>Count</TableHead>
                <TableHead className={headCell}>Oldest due</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.jobs.map((row) => (
                <TableRow key={`${row.kind}-${row.status}`}>
                  <TableCell className={cell}>{row.kind}</TableCell>
                  <TableCell className={cell}>{row.status}</TableCell>
                  <TableCell className={cell}>{row.total}</TableCell>
                  <TableCell className={cell}>
                    {formatDate(row.oldest)}
                  </TableCell>
                </TableRow>
              ))}
              {!data.jobs.length ? (
                <TableRow>
                  <TableCell className={cell} colSpan={4}>
                    The queue is empty.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>

          <h2 className="text-sm font-semibold">Failed jobs</h2>
          <Table className={tableClass}>
            <TableHeader>
              <TableRow>
                <TableHead className={headCell}>Kind</TableHead>
                <TableHead className={headCell}>Attempts</TableHead>
                <TableHead className={headCell}>Last error</TableHead>
                <TableHead className={headCell}>Created</TableHead>
                <TableHead className={headCell} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.dead.map((job) => (
                <TableRow key={job.id}>
                  <TableCell className={cell}>{job.kind}</TableCell>
                  <TableCell className={cell}>{job.attempts}</TableCell>
                  <TableCell
                    className={`${cell} max-w-md break-words font-mono text-xs`}
                  >
                    {job.lastError ?? "—"}
                  </TableCell>
                  <TableCell className={cell}>
                    {formatDate(job.createdAt)}
                  </TableCell>
                  <TableCell className={`${cell} flex gap-2`}>
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() =>
                        void act(
                          () =>
                            trpc.platform.health.retryJob.mutate({
                              id: job.id,
                            }),
                          "Queued to retry",
                        )
                      }
                    >
                      Retry
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        void act(
                          () =>
                            trpc.platform.health.discardJob.mutate({
                              id: job.id,
                            }),
                          "Discarded",
                        )
                      }
                    >
                      Discard
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!data.dead.length ? (
                <TableRow>
                  <TableCell className={cell} colSpan={5}>
                    No failed jobs.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </>
      ) : null}
    </>
  );
}
