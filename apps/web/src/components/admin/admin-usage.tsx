"use client";

import {
  Shell,
  Loading,
  Stat,
  formatBytes,
  useAdminData,
} from "./admin-shell";

export function AdminUsage() {
  const { data, failed } = useAdminData("usage");

  return (
    <Shell>
      {!data ? (
        <Loading failed={failed} />
      ) : (
        <>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Stat label="Tasks" value={String(data.tasks)} />
            <Stat label="Docs" value={String(data.docs)} />
          </dl>
          <section aria-labelledby="uploaders" className="flex flex-col gap-3">
            <h2 id="uploaders" className="text-sm font-semibold text-ink">
              Storage by uploader
            </h2>
            {data.uploaders.length ? (
              <ul className="divide-y divide-line rounded-xl border border-line">
                {data.uploaders.map((row) => (
                  <li
                    key={row.name}
                    className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
                  >
                    <span className="truncate text-ink">{row.name}</span>
                    <span className="font-mono text-ink-2">
                      {row.files} {row.files === 1 ? "file" : "files"} ·{" "}
                      {formatBytes(row.bytes)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-2">No files have been uploaded.</p>
            )}
          </section>
        </>
      )}
    </Shell>
  );
}
