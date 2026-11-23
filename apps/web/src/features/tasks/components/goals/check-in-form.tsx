"use client";

import { useState } from "react";
import { Button } from "@kyren/ui/shadcn/button";
import { Input } from "@kyren/ui/shadcn/input";
import { NativeSelect } from "@kyren/ui/shadcn/native-select";

import { confidenceLabel, type Confidence } from "./goal-types";

/** Moves a metric key result to its latest number. */
export function CheckInForm({
  title,
  value,
  confidence,
  busy,
  onSave,
}: {
  title: string;
  value: number;
  confidence: Confidence;
  busy: boolean;
  onSave: (values: {
    currentValue: number;
    confidence: Confidence;
    note?: string;
  }) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState(String(value));
  const [level, setLevel] = useState<Confidence>(confidence);
  const [note, setNote] = useState("");
  const parsed = Number(draft);
  const valid = draft.trim() !== "" && Number.isFinite(parsed);
  const changed =
    parsed !== value || level !== confidence || note.trim() !== "";

  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();

        if (!valid) return;

        void onSave({
          currentValue: parsed,
          confidence: level,
          note: note.trim() || undefined,
        }).then((saved) => {
          if (saved) setNote("");
        });
      }}
    >
      <Input
        type="number"
        step="any"
        className="h-8 w-28"
        aria-label={`Current value for ${title}`}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
      <NativeSelect
        className="h-8"
        aria-label={`Confidence for ${title}`}
        value={level}
        onChange={(event) => setLevel(event.target.value as Confidence)}
      >
        {(Object.keys(confidenceLabel) as Confidence[]).map((key) => (
          <option key={key} value={key}>
            {confidenceLabel[key]}
          </option>
        ))}
      </NativeSelect>
      <Input
        className="h-8 min-w-52 flex-1"
        maxLength={1000}
        placeholder="What changed? (optional)"
        aria-label={`Check-in note for ${title}`}
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />
      <Button
        type="submit"
        size="sm"
        variant="outline"
        disabled={busy || !valid || !changed}
      >
        Check in
      </Button>
    </form>
  );
}
