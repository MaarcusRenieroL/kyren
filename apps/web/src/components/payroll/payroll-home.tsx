"use client";

import { Button } from "@kyren/ui/shadcn/button";
import { useState } from "react";
import { PageHeader } from "@kyren/ui/components/page-header";

import { MineTab } from "./home/mine-tab";
import type { Tab } from "./home/payroll-types";
import { RunsTab } from "./home/runs-tab";
import { SalariesTab } from "./home/salaries-tab";

export function PayrollHome({
  canViewAll,
  canViewOwn,
}: {
  canViewAll: boolean;
  canViewOwn: boolean;
}) {
  const [tab, setTab] = useState<Tab>(canViewAll ? "runs" : "mine");
  const tabs: { id: Tab; label: string }[] = [
    ...(canViewAll
      ? [
          { id: "runs" as const, label: "Pay runs" },
          { id: "salaries" as const, label: "Salaries" },
        ]
      : []),
    ...(canViewOwn ? [{ id: "mine" as const, label: "My payslips" }] : []),
  ];

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-6 overflow-y-auto p-6">
      <PageHeader
        title="Payroll"
        description="Pay runs built from employee records, approved before anyone is paid."
      />
      <div role="tablist" aria-label="Payroll sections" className="flex gap-1">
        {tabs.map((item) => (
          <Button
            variant="custom"
            key={item.id}
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={`rounded-lg px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              tab === item.id
                ? "bg-sunken font-medium text-ink"
                : "text-ink-2 hover:bg-sunken"
            }`}
          >
            {item.label}
          </Button>
        ))}
      </div>
      {tab === "runs" ? <RunsTab /> : null}
      {tab === "salaries" ? <SalariesTab /> : null}
      {tab === "mine" ? <MineTab /> : null}
    </div>
  );
}
