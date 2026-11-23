"use client";

import { Checkbox } from "@kyren/ui/shadcn/checkbox";
import { useEffect, useState } from "react";
import { useTrpcClient } from "@kyren/api/react";
import { Button } from "@kyren/ui/shadcn/button";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@kyren/ui/shadcn/dialog";
import { Input } from "@kyren/ui/shadcn/input";
import { Label } from "@kyren/ui/shadcn/label";

import { messageOf } from "../../tickets/labels";

/** A correction or one-off payment for some people, on one date. */
export function OffCycleForm({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const trpc = useTrpcClient();
  const [people, setPeople] = useState<Array<{ id: string; name: string }>>([]);
  const [chosen, setChosen] = useState<string[]>([]);
  const [label, setLabel] = useState("");
  const [payDate, setPayDate] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [rate, setRate] = useState("20");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void trpc.payroll.salaries.query().then(
      (data) => setPeople(data.people),
      () => undefined,
    );
  }, [trpc]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();

    if (!payDate) return setError("Pick the pay date.");

    setBusy(true);
    setError(null);
    try {
      const { id } = await trpc.payroll.createOffCycleRun.mutate({
        label,
        payDate,
        currency,
        deductionRateBps: Math.round(Number(rate) * 100),
        employeeIds: chosen,
      });
      onCreated(id);
    } catch (err) {
      setError(messageOf(err) ?? "Could not create the run.");
      setBusy(false);
    }
  }

  function toggle(id: string) {
    setChosen((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>New off-cycle run</DialogTitle>
        <DialogDescription>
          Each pay line starts at zero. Enter the correction or one-off payment
          as a bonus before submitting the run for approval.
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="off-label">Name</Label>
        <Input
          id="off-label"
          autoFocus
          placeholder="Bonus / correction"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="off-date">Pay date</Label>
          <Input
            id="off-date"
            type="date"
            value={payDate}
            onChange={(e) => setPayDate(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="off-rate">Tax rate (%)</Label>
          <Input
            id="off-rate"
            type="number"
            min={0}
            max={100}
            step="0.1"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="off-currency">Currency</Label>
          <Input
            id="off-currency"
            maxLength={3}
            value={currency}
            onChange={(e) => setCurrency(e.target.value.toUpperCase())}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Who is paid?</Label>
        <div className="max-h-48 divide-y divide-line overflow-y-auto rounded-lg border border-line">
          {people.length === 0 ? (
            <p className="p-3 text-sm text-ink-2">No people found.</p>
          ) : (
            people.map((person) => (
              <Label
                key={person.id}
                className="flex items-center gap-2 px-3 py-2 text-sm text-ink hover:bg-sunken"
              >
                <Checkbox
                  checked={chosen.includes(person.id)}
                  onCheckedChange={() => toggle(person.id)}
                  className="rounded border-line"
                />
                <span>{person.name}</span>
              </Label>
            ))
          )}
        </div>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-danger-text">
          {error}
        </p>
      ) : null}
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy || !chosen.length}>
          Create draft
        </Button>
      </DialogFooter>
    </form>
  );
}
