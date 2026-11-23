"use client";

import { useState } from "react";
import { Button } from "@zentro/ui/shadcn/button";
import { Input } from "@zentro/ui/shadcn/input";
import { NativeSelect } from "@zentro/ui/shadcn/native-select";

export function KeyResultForm({
  objectiveId,
  busy,
  onSave,
}: {
  objectiveId: string;
  busy: boolean;
  onSave: (values: {
    title: string;
    kind: "metric" | "tasks";
    startValue: number;
    targetValue: number;
    currentValue: number;
    keys: string[];
  }) => Promise<unknown>;
}) {
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<"metric" | "tasks">("metric");
  const [start, setStart] = useState("0");
  const [target, setTarget] = useState("100");
  const [keys, setKeys] = useState("");

  return (
    <form
      className="flex flex-wrap items-center gap-2 text-sm"
      onSubmit={(event) => {
        event.preventDefault();
        void onSave({
          title,
          kind,
          startValue: Number(start) || 0,
          targetValue: Number(target) || 0,
          currentValue: Number(start) || 0,
          keys:
            kind === "tasks"
              ? keys
                  .split(/[\s,]+/)
                  .map((k) => k.trim())
                  .filter(Boolean)
              : [],
        }).then(() => setTitle(""));
      }}
    >
      <Input
        aria-label="Key result title"
        data-objective={objectiveId}
        placeholder="Key result"
        maxLength={160}
        className="min-w-40 flex-1"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <NativeSelect
        aria-label="Key result type"
        size="sm"
        className="w-28"
        value={kind}
        onChange={(e) => setKind(e.target.value as "metric" | "tasks")}
      >
        <option value="metric">Number</option>
        <option value="tasks">Tasks</option>
      </NativeSelect>
      {kind === "metric" ? (
        <>
          <Input
            aria-label="Start value"
            type="number"
            className="w-24"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
          <Input
            aria-label="Target value"
            type="number"
            className="w-24"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          />
        </>
      ) : (
        <Input
          aria-label="Task keys"
          placeholder="Task keys, e.g. APP-1 APP-2"
          className="w-56"
          value={keys}
          onChange={(e) => setKeys(e.target.value)}
        />
      )}
      <Button type="submit" size="sm" disabled={busy || !title.trim()}>
        Add key result
      </Button>
    </form>
  );
}
