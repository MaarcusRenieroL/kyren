"use client";

import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@kyren/ui/shadcn/table";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, DownloadIcon } from "lucide-react";

import { useTrpcClient } from "@kyren/api/react";
import type { AppRouter } from "@kyren/api/server";
import type { inferRouterOutputs } from "@trpc/server";
import { EmptyState } from "@kyren/ui/components/empty-state";
import { PageHeader } from "@kyren/ui/components/page-header";
import { Button } from "@kyren/ui/shadcn/button";
import { Input } from "@kyren/ui/shadcn/input";
import { toast, toastError } from "@kyren/ui/index";

import { usePageCrumb } from "~/src/components/shell/breadcrumb-context";

import { useAsyncData } from "~/src/lib/use-async-data";

import { isMissing, messageOf } from "../tickets/labels";
import { formatMoney, formatPeriod, runTone, toMajor, toMinor } from "./money";

type Run = inferRouterOutputs<AppRouter>["payroll"]["run"];

export function RunDetail({ id }: { id: string }) {
  const trpc = useTrpcClient();
  const router = useRouter();
  const [bonuses, setBonuses] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const {
    data: run,
    status,
    error,
    reload,
  } = useAsyncData<Run>(() => trpc.payroll.run.query({ id }), [trpc, id]);

  usePageCrumb(`/payroll/${id}`, run?.label ?? "Pay run");

  async function act(
    action: () => Promise<unknown>,
    failure: string,
    done?: string,
  ) {
    setBusy(true);
    try {
      await action();
      if (done) toast.success(done);
      reload();
    } catch (error) {
      toastError(failure, messageOf(error));
    } finally {
      setBusy(false);
    }
  }

  if (status === "error" && !isMissing(error))
    return (
      <div className="p-6">
        <EmptyState
          title="The pay run did not load"
          description="Check your connection and try again."
          action={<Button onClick={reload}>Retry</Button>}
        />
      </div>
    );

  if (status === "error")
    return (
      <div className="p-6">
        <EmptyState
          title="Pay run not found"
          description="It may have been deleted, or you may not have access."
          action={
            <Button asChild>
              <Link href="/payroll">Back to payroll</Link>
            </Button>
          }
        />
      </div>
    );

  if (!run)
    return (
      <p role="status" className="p-6 text-sm text-ink-2">
        Loading pay run…
      </p>
    );

  async function exportCsv() {
    if (!run) return;

    try {
      // The server builds the file so every download is recorded.
      const file = await trpc.payroll.exportRun.mutate({ id: run.id });
      const url = URL.createObjectURL(
        new Blob([file.csv], { type: "text/csv;charset=utf-8" }),
      );
      const link = document.createElement("a");

      link.href = url;
      link.download = file.filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toastError(error, "Could not export the pay run.");
    }
  }

  const editable = run.status === "draft" && run.canManage;
  const currency = run.lines[0]?.currency ?? "USD";
  const total = run.lines.reduce((sum, line) => sum + line.net, 0);
  const deductions = run.lines.reduce((sum, line) => sum + line.deductions, 0);

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-6 overflow-y-auto p-6">
      <PageHeader
        breadcrumbs={
          <Link
            href="/payroll"
            className="inline-flex items-center gap-1 text-sm text-ink-2 hover:underline"
          >
            <ArrowLeftIcon className="size-3.5" aria-hidden />
            Payroll
          </Link>
        }
        title={run.label}
        meta={
          <span
            className={`rounded-full px-2 py-0.5 text-xs capitalize ${runTone[run.status]}`}
          >
            {run.status}
          </span>
        }
        description={`${formatPeriod(run.periodStart, run.periodEnd)} · ${run.deductionRateBps / 100}% held back as tax and contributions`}
        actions={
          <>
            {run.status === "draft" ? null : (
              <Button variant="outline" onClick={() => void exportCsv()}>
                <DownloadIcon aria-hidden />
                Export CSV
              </Button>
            )}
            {run.status === "draft" && run.canManage ? (
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  if (!window.confirm(`Delete the pay run “${run.label}”?`))
                    return;
                  void act(async () => {
                    await trpc.payroll.deleteRun.mutate({ id: run.id });
                    router.push("/payroll");
                  }, "Could not delete the pay run");
                }}
              >
                Delete
              </Button>
            ) : null}
            {run.status === "draft" &&
            run.canApprove &&
            run.approvalNeedsSomeoneElse ? (
              <p className="max-w-56 text-xs text-ink-2">
                Another admin approves this run: you created or changed it.
              </p>
            ) : null}
            {run.status === "draft" &&
            run.canApprove &&
            !run.approvalNeedsSomeoneElse ? (
              <Button
                disabled={busy}
                onClick={() =>
                  void act(
                    () => trpc.payroll.approveRun.mutate({ id: run.id }),
                    "Could not approve",
                    "Pay run approved",
                  )
                }
              >
                Approve
              </Button>
            ) : null}
            {run.status === "approved" && run.canApprove ? (
              <Button
                disabled={busy}
                onClick={() =>
                  void act(
                    () => trpc.payroll.markPaid.mutate({ id: run.id }),
                    "Could not mark as paid",
                    "Marked as paid",
                  )
                }
              >
                Mark as paid
              </Button>
            ) : null}
          </>
        }
      />

      <dl className="grid gap-4 sm:grid-cols-3">
        {[
          ["People", String(run.lines.length)],
          ["Deductions", formatMoney(deductions, currency)],
          ["Net to pay", formatMoney(total, currency)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-line p-4">
            <dt className="text-xs text-ink-2">{label}</dt>
            <dd className="font-mono text-lg text-ink">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="overflow-x-auto rounded-xl border border-line">
        <Table className="w-full min-w-[34rem] text-sm">
          <TableHeader>
            <TableRow className="border-b border-line text-left text-xs text-ink-2">
              <TableHead className="px-3 py-2 font-medium">Employee</TableHead>
              <TableHead className="px-3 py-2 text-right font-medium">
                Base
              </TableHead>
              <TableHead className="px-3 py-2 text-right font-medium">
                Bonus
              </TableHead>
              <TableHead className="px-3 py-2 text-right font-medium">
                Deductions
              </TableHead>
              <TableHead className="px-3 py-2 text-right font-medium">
                Net
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-line">
            {run.lines.map((line) => (
              <TableRow key={line.id}>
                <TableCell className="px-3 py-2 text-ink">
                  {line.employeeName}
                </TableCell>
                <TableCell className="px-3 py-2 text-right font-mono">
                  {formatMoney(line.base, line.currency)}
                </TableCell>
                <TableCell className="px-3 py-2 text-right font-mono">
                  {editable ? (
                    <form
                      className="flex items-center justify-end gap-2"
                      onSubmit={(event) => {
                        event.preventDefault();
                        const value = Number(bonuses[line.id]);

                        if (!Number.isFinite(value) || value < 0)
                          return toastError(
                            "Enter a bonus",
                            "Use a number such as 500.",
                          );

                        void act(async () => {
                          await trpc.payroll.setBonus.mutate({
                            payslipId: line.id,
                            bonus: toMinor(value, line.currency),
                          });
                          setBonuses((current) => {
                            const next = { ...current };
                            delete next[line.id];
                            return next;
                          });
                        }, "Could not set the bonus");
                      }}
                    >
                      <Input
                        aria-label={`Bonus for ${line.employeeName}`}
                        inputMode="decimal"
                        className="w-20 text-right"
                        value={
                          bonuses[line.id] ??
                          String(toMajor(line.bonus, line.currency))
                        }
                        onChange={(e) =>
                          setBonuses((current) => ({
                            ...current,
                            [line.id]: e.target.value,
                          }))
                        }
                      />
                      <Button
                        type="submit"
                        size="sm"
                        variant="outline"
                        disabled={busy || bonuses[line.id] === undefined}
                      >
                        Set
                      </Button>
                    </form>
                  ) : (
                    formatMoney(line.bonus, line.currency)
                  )}
                </TableCell>
                <TableCell className="px-3 py-2 text-right font-mono">
                  {formatMoney(line.deductions, line.currency)}
                </TableCell>
                <TableCell className="px-3 py-2 text-right font-mono font-medium">
                  {formatMoney(line.net, line.currency)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
