"use client";

import { FC, useCallback, useEffect, useMemo, useState } from "react";
import { DownloadIcon } from "lucide-react";

import { useTrpcClient } from "@kyren/api/react";
import { toastError } from "@kyren/ui/index";
import { Button } from "@kyren/ui/shadcn/button";
import { EmptyState } from "@kyren/ui/components/empty-state";
import { Skeleton } from "@kyren/ui/shadcn/skeleton";

import { ActorAvatar } from "~/src/components/actor-avatar";
import { usePermission } from "~/src/components/permissions/permission-provider";
import { sentenceFor } from "~/src/components/workspace/activity/activity-feed";
import { useFrameAction } from "~/src/components/workspace/settings/frames";
import { trpcResult } from "~/src/lib/trpc-result";

import { allValue, clock, dayHeading, moduleOf, type Row } from "./audit/types";
import { AuditFilterBar } from "./audit/audit-filter-bar";
import { AuditEventSheet } from "./audit/audit-event-sheet";

export const AuditLog: FC = () => {
  const trpc = useTrpcClient();
  const canExport = usePermission("audit_logs.export");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [actors, setActors] = useState<Array<{ id: string; label: string }>>(
    [],
  );
  const [actor, setActor] = useState(allValue);
  const [prefix, setPrefix] = useState(allValue);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [reload, setReload] = useState(0);
  const [selected, setSelected] = useState<Row | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(id);
  }, [search]);

  const filter = useCallback(
    () => ({
      actorUserId: actor === allValue ? undefined : actor,
      actionPrefix: prefix === allValue ? undefined : prefix,
      from: from ? new Date(`${from}T00:00:00`) : undefined,
      to: to ? new Date(`${to}T23:59:59.999`) : undefined,
      search: debounced.trim() || undefined,
    }),
    [actor, prefix, from, to, debounced],
  );

  const load = useCallback(
    async (next?: string) => {
      const { data, error } = await trpcResult(
        trpc.audit.list.query({ ...filter(), cursor: next }),
      );

      if (error) {
        toastError(error.statusText, error.message);
        setRows([]);
        return;
      }

      setRows((current) =>
        next
          ? [...(current ?? []), ...(data.items as Row[])]
          : (data.items as Row[]),
      );
      setCursor(data.nextCursor);
    },
    [trpc, filter],
  );

  useEffect(() => {
    void load();
  }, [load, reload]);

  useEffect(() => {
    void trpcResult(trpc.member.getMembers.query()).then(({ data }) =>
      setActors(
        (data ?? []).map((member) => ({
          id: member.userId,
          label: member.name || member.email,
        })),
      ),
    );
  }, [trpc]);

  async function exportCsv() {
    const { data, error } = await trpcResult(
      trpc.audit.export.mutate(filter()),
    );

    if (error) {
      toastError(error.statusText, error.message);
      return;
    }

    const url = URL.createObjectURL(new Blob([data.csv], { type: "text/csv" }));
    const link = document.createElement("a");

    link.href = url;
    link.download = data.filename;
    link.click();
    URL.revokeObjectURL(url);
    setReload((count) => count + 1);
  }

  const groups = useMemo(() => {
    const days: Array<{ label: string; rows: Row[] }> = [];

    for (const row of rows ?? []) {
      const label = dayHeading(row.createdAt);
      const last = days[days.length - 1];

      if (last && last.label === label) last.rows.push(row);
      else days.push({ label, rows: [row] });
    }

    return days;
  }, [rows]);

  const framedExport = useFrameAction(
    canExport ? "Export CSV" : null,
    () => void exportCsv(),
    "export",
  );

  const filtering =
    actor !== allValue || prefix !== allValue || from || to || debounced.trim();

  return (
    <div className="flex flex-col gap-4" data-testid="audit-log">
      {framedExport ? null : (
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-[22px] leading-7 font-semibold">Audit log</h2>
          <span className="flex-1" />
          {canExport ? (
            <Button variant="outline" onClick={exportCsv}>
              <DownloadIcon />
              Export CSV
            </Button>
          ) : null}
        </div>
      )}

      <AuditFilterBar
        search={search}
        onSearchChange={setSearch}
        actor={actor}
        onActorChange={setActor}
        actors={actors}
        prefix={prefix}
        onPrefixChange={setPrefix}
        from={from}
        onFromChange={setFrom}
        to={to}
        onToChange={setTo}
        eventsCountText={
          rows ? `${rows.length}${cursor ? "+" : ""} events` : ""
        }
      />

      {!rows ? (
        <div className="flex flex-col gap-1" aria-busy="true">
          {[0, 1, 2, 3, 4, 5].map((row) => (
            <Skeleton key={row} className="h-12" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          title={
            filtering ? "No events match those filters." : "No events yet."
          }
          description={
            filtering
              ? "Widen the dates or clear the search."
              : "Changes made in the organization are recorded here."
          }
        />
      ) : (
        <div className="flex flex-col gap-3.5">
          {groups.map((group) => (
            <section
              key={group.label}
              aria-label={group.label}
              className="flex flex-col"
            >
              <h3 className="eyebrow px-3 pt-2 pb-1.5">{group.label}</h3>
              <ol aria-label="Events, newest first">
                {group.rows.map((row) => {
                  const actorLabel =
                    row.actorName ?? row.actorEmail ?? "System";

                  return (
                    <li key={row.id}>
                      <Button
                        variant="custom"
                        type="button"
                        onClick={() => setSelected(row)}
                        className="flex min-h-12 w-full items-center gap-3 rounded-xl border-t border-hairline/60 px-3 py-2 text-left outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <time
                          dateTime={new Date(row.createdAt).toISOString()}
                          className="w-[68px] shrink-0 font-mono text-xs text-ink-3"
                        >
                          {clock(row.createdAt)}
                        </time>
                        <ActorAvatar name={actorLabel} size={26} />
                        <span className="min-w-0 flex-1 text-sm break-words">
                          {sentenceFor(row)}
                        </span>
                        <span className="hidden rounded-sm border border-hairline px-1.5 py-px font-mono text-[11px] text-ink-2 sm:block">
                          {moduleOf(row.action)}
                        </span>
                        <span className="hidden w-28 text-right font-mono text-xs text-ink-3 md:block">
                          {row.ip ?? ""}
                        </span>
                      </Button>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      )}

      {cursor ? (
        <Button
          variant="outline"
          className="self-start"
          onClick={() => load(cursor)}
        >
          Load more
        </Button>
      ) : null}

      <AuditEventSheet selected={selected} onClose={() => setSelected(null)} />
    </div>
  );
};
