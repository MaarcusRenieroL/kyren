"use client";

import { useState } from "react";
import { useTrpcClient } from "@kyren/api/react";
import { Button } from "@kyren/ui/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@kyren/ui/shadcn/dialog";
import { Input } from "@kyren/ui/shadcn/input";
import { Label } from "@kyren/ui/shadcn/label";

import { messageOf } from "../../tickets/labels";

export function NewRunDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        {open ? <RunForm onClose={onClose} onCreated={onCreated} /> : null}
      </DialogContent>
    </Dialog>
  );
}

export function RunForm({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const trpc = useTrpcClient();
  const [label, setLabel] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [rate, setRate] = useState("20");
  const [currency, setCurrency] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();

    if (!periodStart || !periodEnd) return setError("Pick the period.");

    setBusy(true);
    setError(null);
    try {
      const { id } = await trpc.payroll.createRun.mutate({
        label,
        periodStart,
        periodEnd,
        deductionRateBps: Math.round(Number(rate) * 100),
        ...(currency.trim() ? { currency: currency.trim() } : {}),
      });
      onCreated(id);
    } catch (err) {
      setError(messageOf(err) ?? "Could not create the pay run.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>New pay run</DialogTitle>
        <DialogDescription>
          Each paid employee gets a line for the days they worked in the period.
          A run pays one currency.
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="run-label">Name</Label>
        <Input
          id="run-label"
          autoFocus
          placeholder="November 2026"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="run-start">Period start</Label>
          <Input
            id="run-start"
            type="date"
            value={periodStart}
            onChange={(e) => setPeriodStart(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="run-end">Period end</Label>
          <Input
            id="run-end"
            type="date"
            min={periodStart || undefined}
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="run-rate">Tax and contributions (%)</Label>
        <Input
          id="run-rate"
          type="number"
          min={0}
          max={100}
          step="0.1"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="run-currency">Currency</Label>
        <Input
          id="run-currency"
          maxLength={3}
          placeholder="Only needed if people are paid in several"
          value={currency}
          onChange={(e) => setCurrency(e.target.value.toUpperCase())}
        />
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
        <Button type="submit" disabled={busy}>
          Create draft
        </Button>
      </DialogFooter>
    </form>
  );
}
