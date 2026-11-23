"use client";

import { Input } from "@kyren/ui/shadcn/input";
import { useState } from "react";
import { Button } from "@kyren/ui/shadcn/button";

type Props = {
  isLogging: boolean;
  onLog: (minutes: number, note?: string) => void;
};

export function ManualTimeForm({ isLogging, onLog }: Props) {
  const [manualMinutes, setManualMinutes] = useState("");
  const [manualNote, setManualNote] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const mins = parseInt(manualMinutes, 10);
        if (!isNaN(mins) && mins > 0) {
          onLog(mins, manualNote);
          setManualMinutes("");
          setManualNote("");
        }
      }}
      className="mb-4 flex flex-col gap-2 rounded-lg border border-hairline bg-surface-subtle p-3"
    >
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min="1"
          max="1440"
          value={manualMinutes}
          onChange={(e) => setManualMinutes(e.target.value)}
          placeholder="Minutes (e.g. 45)"
          className="h-8 w-36 rounded-md border border-hairline bg-surface px-2.5 font-mono text-xs outline-none focus-visible:border-ring"
          autoFocus
        />
        <Input
          type="text"
          value={manualNote}
          onChange={(e) => setManualNote(e.target.value)}
          placeholder="Optional note"
          className="h-8 flex-1 rounded-md border border-hairline bg-surface px-2.5 text-xs outline-none focus-visible:border-ring"
        />
        <Button
          size="sm"
          type="submit"
          disabled={isLogging || !manualMinutes}
          className="h-8 text-xs"
        >
          Log
        </Button>
      </div>
    </form>
  );
}
