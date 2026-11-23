"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTrpcClient } from "@zentro/api/react";
import { EmptyState } from "@zentro/ui/components/empty-state";

import { formatMoney, formatPeriod, runTone } from "../money";
import type { Mine } from "./payroll-types";

export function MineTab() {
  const trpc = useTrpcClient();
  const [slips, setSlips] = useState<Mine | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    trpc.payroll.mine.query().then(setSlips, () => setFailed(true));
  }, [trpc]);

  if (failed)
    return (
      <EmptyState
        title="Payslips did not load"
        description="Check your connection and try again."
      />
    );

  if (!slips)
    return (
      <p role="status" className="text-sm text-ink-2">
        Loading payslips…
      </p>
    );

  if (!slips.length)
    return (
      <EmptyState
        title="No payslips yet"
        description="Your payslips appear here once a pay run that includes you is approved."
      />
    );

  return (
    <ul className="divide-y divide-line rounded-xl border border-line">
      {slips.map((slip) => (
        <li
          key={slip.id}
          className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3"
        >
          <div className="min-w-0 flex-[1_1_14rem]">
            <p className="truncate font-medium text-ink">{slip.label}</p>
            <p className="text-sm text-ink-2">
              {formatPeriod(slip.periodStart, slip.periodEnd)} · gross{" "}
              {formatMoney(slip.base + slip.bonus, slip.currency)} · deductions{" "}
              {formatMoney(slip.deductions, slip.currency)}
            </p>
          </div>
          <span className="font-mono text-sm text-ink">
            {formatMoney(slip.net, slip.currency)}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs capitalize ${runTone[slip.status]}`}
          >
            {slip.status}
          </span>
          <Link
            href={`/payslip/${slip.id}`}
            className="text-sm underline"
            aria-label={`Payslip for ${slip.label}`}
          >
            Payslip
          </Link>
        </li>
      ))}
    </ul>
  );
}
