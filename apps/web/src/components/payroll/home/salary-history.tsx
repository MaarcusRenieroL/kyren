"use client";

import { useState } from "react";
import { useTrpcClient } from "@zentro/api/react";
import { Button } from "@zentro/ui/shadcn/button";
import { toastError } from "@zentro/ui/index";

import { formatMoney } from "../money";

/** Past salaries for one person, loaded when opened. */
export function SalaryHistory({
  employeeId,
  name,
}: {
  employeeId: string;
  name: string;
}) {
  const trpc = useTrpcClient();
  const [rows, setRows] = useState<Awaited<
    ReturnType<typeof trpc.payroll.salaryHistory.query>
  > | null>(null);
  const [open, setOpen] = useState(false);

  async function toggle() {
    const next = !open;

    setOpen(next);

    if (next) {
      try {
        setRows(await trpc.payroll.salaryHistory.query({ employeeId }));
      } catch (error) {
        toastError(error, "Could not load the salary history.");
      }
    }
  }

  return (
    <div className="basis-full">
      <Button
        size="sm"
        variant="ghost"
        aria-expanded={open}
        aria-label={`Salary history for ${name}`}
        onClick={() => void toggle()}
      >
        History
      </Button>
      {open && !rows ? (
        <p role="status" className="mt-1 text-sm text-ink-2">
          Loading history…
        </p>
      ) : null}
      {open && rows && rows.length === 0 ? (
        <p className="mt-1 text-sm text-ink-2">No changes recorded yet.</p>
      ) : null}
      {open && rows && rows.length ? (
        <ul className="mt-1 flex flex-col gap-1 text-sm text-ink-2">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-wrap gap-x-3">
              <span className="font-mono text-ink">
                {formatMoney(row.annualSalary, row.currency)}
              </span>
              <span>{new Date(row.at).toLocaleDateString()}</span>
              <span>{row.changedBy ? `by ${row.changedBy}` : ""}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
