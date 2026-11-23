"use client";

import { useCallback, useEffect, useState } from "react";
import { useTrpcClient } from "@kyren/api/react";
import { EmptyState } from "@kyren/ui/components/empty-state";
import { Button } from "@kyren/ui/shadcn/button";
import { Input } from "@kyren/ui/shadcn/input";
import { toast, toastError } from "@kyren/ui/index";

import { messageOf } from "../../tickets/labels";
import { formatMoney, toMajor, toMinor } from "../money";
import type { Salaries } from "./payroll-types";
import { SalaryHistory } from "./salary-history";

export function SalariesTab() {
  const trpc = useTrpcClient();
  const [data, setData] = useState<Salaries | null>(null);
  const [failed, setFailed] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      setData(await trpc.payroll.salaries.query());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [trpc]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(person: Salaries["people"][number]) {
    const value = Number(drafts[person.id]);

    if (!Number.isFinite(value) || value < 0) {
      return toastError("Enter a salary", "Use a number such as 60000.");
    }

    try {
      await trpc.payroll.setSalary.mutate({
        employeeId: person.id,
        annualSalary: toMinor(value, person.currency ?? "USD"),
        currency: person.currency ?? "USD",
      });
      setDrafts((current) => {
        const next = { ...current };
        delete next[person.id];
        return next;
      });
      toast.success("Salary saved");
      await load();
    } catch (error) {
      toastError("Could not save the salary", messageOf(error));
    }
  }

  if (failed)
    return (
      <EmptyState
        title="Salaries did not load"
        description="Check your connection and try again."
        action={<Button onClick={() => void load()}>Retry</Button>}
      />
    );

  if (!data)
    return (
      <p role="status" className="text-sm text-ink-2">
        Loading salaries…
      </p>
    );

  if (!data.people.length)
    return (
      <EmptyState
        title="No employees yet"
        description="Add people in HR, then set what they are paid here."
      />
    );

  return (
    <ul className="divide-y divide-line rounded-xl border border-line">
      {data.people.map((person) => {
        const draft = drafts[person.id];

        return (
          <li
            key={person.id}
            className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3"
          >
            <div className="min-w-0 flex-[1_1_14rem]">
              <p className="truncate font-medium text-ink">{person.name}</p>
              <p className="text-sm text-ink-2">
                {person.jobTitle || "No title"}
              </p>
            </div>
            {data.canManage ? (
              <form
                className="flex items-center gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void save(person);
                }}
              >
                <Input
                  aria-label={`Annual salary for ${person.name}`}
                  inputMode="decimal"
                  className="w-32"
                  placeholder="Not set"
                  value={
                    draft ??
                    (person.annualSalary !== null
                      ? String(
                          toMajor(
                            person.annualSalary,
                            person.currency ?? "USD",
                          ),
                        )
                      : "")
                  }
                  onChange={(e) =>
                    setDrafts((current) => ({
                      ...current,
                      [person.id]: e.target.value,
                    }))
                  }
                />
                <span className="w-10 text-xs text-ink-3">
                  {person.currency ?? "USD"}
                </span>
                <Button
                  type="submit"
                  size="sm"
                  variant="outline"
                  disabled={draft === undefined}
                >
                  Save
                </Button>
              </form>
            ) : (
              <span className="font-mono text-sm text-ink">
                {person.annualSalary !== null
                  ? formatMoney(person.annualSalary, person.currency ?? "USD")
                  : "Not set"}
              </span>
            )}
            {person.annualSalary !== null ? (
              <SalaryHistory employeeId={person.id} name={person.name} />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
