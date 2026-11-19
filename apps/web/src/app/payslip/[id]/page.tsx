"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PrinterIcon } from "lucide-react";

import { useTrpcClient } from "@zentro/api/react";
import type { AppRouter } from "@zentro/api/server";
import { TRPCClientError } from "@trpc/client";
import type { inferRouterOutputs } from "@trpc/server";
import { Button } from "@zentro/ui/shadcn/button";

import { formatMoney, formatPeriod } from "~/src/components/payroll/money";

type Payslip = inferRouterOutputs<AppRouter>["payroll"]["payslip"];

/** One payslip on its own page, laid out to print or save as a PDF. */
export default function PayslipPage() {
  const { id } = useParams<{ id: string }>();
  const trpc = useTrpcClient();
  const [slip, setSlip] = useState<Payslip | null>(null);
  const [problem, setProblem] = useState<{
    title: string;
    detail: string;
  } | null>(null);

  useEffect(() => {
    trpc.payroll.payslip.query({ id }).then(setSlip, (error: unknown) => {
      const code =
        error instanceof TRPCClientError
          ? (error.data as { code?: string } | undefined)?.code
          : undefined;

      setProblem(
        code === "NOT_FOUND"
          ? {
              title: "Payslip not found",
              detail:
                "It may belong to someone else, or its pay run isn't approved yet.",
            }
          : {
              // Payroll turned off, a suspended organization, a sign-in that
              // needs two-factor, or the network: say what the server said.
              title: "This payslip can't be opened",
              detail:
                error instanceof Error && error.message
                  ? error.message
                  : "Check your connection and try again.",
            },
      );
    });
  }, [trpc, id]);

  if (problem) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-3 p-6">
        <h1 className="text-xl font-semibold text-ink">{problem.title}</h1>
        <p className="text-sm text-ink-2">{problem.detail}</p>
        <Link href="/payroll" className="text-sm underline">
          Back to payroll
        </Link>
      </main>
    );
  }

  if (!slip) {
    return (
      <p role="status" className="p-6 text-sm text-ink-2">
        Loading payslip…
      </p>
    );
  }

  const money = (minor: number) => formatMoney(minor, slip.currency);
  const rows: [string, string][] = [
    ["Base pay", money(slip.base)],
    ["Bonus", money(slip.bonus)],
    ["Gross pay", money(slip.gross)],
    [
      `Tax and contributions (${slip.deductionRateBps / 100}%)`,
      `−${money(slip.deductions)}`,
    ],
  ];

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 p-8 print:p-0">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Link href="/payroll" className="text-sm text-ink-2 underline">
          Back to payroll
        </Link>
        <Button onClick={() => window.print()}>
          <PrinterIcon aria-hidden />
          Print or save as PDF
        </Button>
      </div>

      <header className="flex flex-col gap-1 border-b border-line pb-6">
        <p className="text-sm text-ink-2">{slip.organization}</p>
        <h1 className="text-2xl font-semibold text-ink">Payslip</h1>
        <p className="text-sm text-ink-2">
          {slip.label}
          {slip.kind === "off_cycle" ? " (off-cycle)" : ""} ·{" "}
          {formatPeriod(slip.periodStart, slip.periodEnd)}
        </p>
      </header>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
        <dt className="text-ink-2">Employee</dt>
        <dd className="text-ink">{slip.employeeName}</dd>
        {slip.jobTitle ? (
          <>
            <dt className="text-ink-2">Role</dt>
            <dd className="text-ink">{slip.jobTitle}</dd>
          </>
        ) : null}
        <dt className="text-ink-2">Status</dt>
        <dd className="capitalize text-ink">
          {slip.status}
          {slip.paidAt
            ? ` on ${new Date(slip.paidAt).toLocaleDateString()}`
            : ""}
        </dd>
      </dl>

      <table className="w-full text-sm">
        <caption className="sr-only">Pay for this period</caption>
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label} className="border-b border-line">
              <th scope="row" className="py-2 text-left font-normal text-ink-2">
                {label}
              </th>
              <td className="py-2 text-right font-mono text-ink">{value}</td>
            </tr>
          ))}
          <tr>
            <th scope="row" className="py-3 text-left font-semibold text-ink">
              Net pay
            </th>
            <td className="py-3 text-right font-mono text-lg font-semibold text-ink">
              {money(slip.net)}
            </td>
          </tr>
        </tbody>
      </table>
    </main>
  );
}
