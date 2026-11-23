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
import { NativeSelect } from "@kyren/ui/shadcn/native-select";

import { messageOf } from "../tickets/labels";
import { typeLabels } from "./leave-helpers";

export function RequestDialog({
  open,
  onClose,
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  onSent: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        {open ? <RequestForm onClose={onClose} onSent={onSent} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function RequestForm({
  onClose,
  onSent,
}: {
  onClose: () => void;
  onSent: () => void;
}) {
  const trpc = useTrpcClient();
  const [type, setType] = useState("annual");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();

    if (!startDate || !endDate) return setError("Pick the first and last day.");

    setBusy(true);
    setError(null);
    try {
      await trpc.hr.leaveRequest.mutate({
        type: type as "annual",
        startDate,
        endDate,
        note: note.trim() || null,
      });
      onSent();
    } catch (err) {
      setError(messageOf(err) ?? "Could not send the request.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Request time off</DialogTitle>
        <DialogDescription>Weekends are not counted.</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="lv-type">Type</Label>
        <NativeSelect
          id="lv-type"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          {Object.entries(typeLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="lv-start">First day</Label>
          <Input
            id="lv-start"
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              if (!endDate || endDate < e.target.value)
                setEndDate(e.target.value);
            }}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="lv-end">Last day</Label>
          <Input
            id="lv-end"
            type="date"
            min={startDate || undefined}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="lv-note">Note (optional)</Label>
        <Input
          id="lv-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
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
          Send request
        </Button>
      </DialogFooter>
    </form>
  );
}
