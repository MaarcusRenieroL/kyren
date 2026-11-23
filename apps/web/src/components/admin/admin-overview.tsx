"use client";

import Link from "next/link";
import { CheckCircle2Icon, CircleIcon } from "lucide-react";
import {
  Shell,
  Loading,
  Stat,
  formatBytes,
  dateFormat,
  useAdminData,
} from "./admin-shell";

export function AdminOverview() {
  const { data, failed } = useAdminData("overview");

  return (
    <Shell>
      {!data ? (
        <Loading failed={failed} />
      ) : (
        <>
          <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat
              label="Members"
              value={String(data.members)}
              hint={
                data.pendingInvites
                  ? `${data.pendingInvites} invited`
                  : undefined
              }
            />
            <Stat label="Teams" value={String(data.teams)} />
            <Stat label="Projects" value={String(data.projects)} />
            <Stat
              label="Storage"
              value={formatBytes(data.storageBytes)}
              hint={`${data.fileCount} files`}
            />
          </dl>

          <div className="grid gap-6 lg:grid-cols-2">
            <section aria-labelledby="setup" className="flex flex-col gap-3">
              <h2 id="setup" className="text-sm font-semibold text-ink">
                Setup
              </h2>
              <ul className="divide-y divide-line rounded-xl border border-line">
                {data.setup.map((step) => (
                  <li key={step.id}>
                    <Link
                      href={step.href}
                      className="flex items-center gap-3 px-4 py-3 text-sm outline-none hover:bg-sunken focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {step.done ? (
                        <CheckCircle2Icon
                          className="size-4 text-ink"
                          aria-label="Done"
                        />
                      ) : (
                        <CircleIcon
                          className="size-4 text-ink-3"
                          aria-label="To do"
                        />
                      )}
                      <span className={step.done ? "text-ink-2" : "text-ink"}>
                        {step.label}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>

            <section aria-labelledby="recent" className="flex flex-col gap-3">
              <h2 id="recent" className="text-sm font-semibold text-ink">
                Recent actions
              </h2>
              {data.recent.length ? (
                <ul className="divide-y divide-line rounded-xl border border-line">
                  {data.recent.map((event) => (
                    <li key={event.id} className="px-4 py-3 text-sm">
                      <p className="text-ink">{event.text}</p>
                      <p className="text-xs text-ink-3">
                        {dateFormat.format(new Date(event.at))}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink-2">Nothing has happened yet.</p>
              )}
              <Link
                href="/settings/organization/audit-log"
                className="text-sm text-ink-2 underline"
              >
                Open the full audit log
              </Link>
            </section>
          </div>
        </>
      )}
    </Shell>
  );
}
