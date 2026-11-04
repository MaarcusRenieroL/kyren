"use client";

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
          <table className={tableClass}>
            <thead>
              <tr>
                <th className={headCell}>Kind</th>
                <th className={headCell}>Status</th>
                <th className={headCell}>Count</th>
                <th className={headCell}>Oldest due</th>
              </tr>
            </thead>
            <tbody>
              {data.jobs.map((row) => (
                <tr key={`${row.kind}-${row.status}`}>
                  <td className={cell}>{row.kind}</td>
                  <td className={cell}>{row.status}</td>
                  <td className={cell}>{row.total}</td>
                  <td className={cell}>{formatDate(row.oldest)}</td>
                </tr>
              ))}
              {!data.jobs.length ? (
                <tr>
                  <td className={cell} colSpan={4}>
                    The queue is empty.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>

          <h2 className="text-sm font-semibold">Failed jobs</h2>
          <table className={tableClass}>
            <thead>
              <tr>
                <th className={headCell}>Kind</th>
                <th className={headCell}>Attempts</th>
                <th className={headCell}>Last error</th>
                <th className={headCell}>Created</th>
                <th className={headCell} />
              </tr>
            </thead>
            <tbody>
              {data.dead.map((job) => (
                <tr key={job.id}>
                  <td className={cell}>{job.kind}</td>
                  <td className={cell}>{job.attempts}</td>
                  <td
                    className={`${cell} max-w-md break-words font-mono text-xs`}
                  >
                    {job.lastError ?? "—"}
                  </td>
                  <td className={cell}>{formatDate(job.createdAt)}</td>
                  <td className={`${cell} flex gap-2`}>
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
                  </td>
                </tr>
              ))}
              {!data.dead.length ? (
                <tr>
                  <td className={cell} colSpan={5}>
                    No failed jobs.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </>
      ) : null}
    </>
  );
}
