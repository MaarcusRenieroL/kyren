"use client";

import { useState } from "react";
import { Button } from "@kyren/ui/shadcn/button";
import { Input } from "@kyren/ui/shadcn/input";

import { percent } from "./goal-types";

/** A goal's title line: rename, close or reopen, and delete. */
export function GoalHeader({
  goal,
  canManage,
  busy,
  onSave,
  onDelete,
}: {
  goal: {
    title: string;
    period: string | null;
    status: string;
    progress: number;
  };
  canManage: boolean;
  busy: boolean;
  onSave: (
    changes: { title?: string; status?: "active" | "closed" },
    done: string,
  ) => Promise<boolean>;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(goal.title);
  const closed = goal.status === "closed";

  if (editing) {
    return (
      <form
        className="flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();

          if (!draft.trim()) return;
          void onSave({ title: draft.trim() }, "Goal renamed").then((saved) => {
            if (saved) setEditing(false);
          });
        }}
      >
        <Input
          aria-label={`New title for ${goal.title}`}
          maxLength={160}
          className="flex-1"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          autoFocus
        />
        <Button type="submit" size="sm" disabled={busy || !draft.trim()}>
          Save
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            setDraft(goal.title);
            setEditing(false);
          }}
        >
          Cancel
        </Button>
      </form>
    );
  }

  return (
    <div className="flex flex-wrap items-baseline gap-2">
      <h2 className="min-w-0 flex-[1_1_14rem] text-base font-medium text-ink">
        {goal.title}
      </h2>
      {closed ? (
        <span className="rounded-full border border-hairline px-2 text-xs text-ink-2">
          Closed
        </span>
      ) : null}
      {goal.period ? (
        <span className="text-xs text-ink-2">{goal.period}</span>
      ) : null}
      <span className="text-sm font-medium text-ink">
        {percent(goal.progress)}
      </span>
      {canManage ? (
        <>
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            aria-label={`Rename goal ${goal.title}`}
            onClick={() => setEditing(true)}
          >
            Rename
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            aria-label={`${closed ? "Reopen" : "Close"} goal ${goal.title}`}
            onClick={() =>
              void onSave(
                { status: closed ? "active" : "closed" },
                closed ? "Goal reopened" : "Goal closed",
              )
            }
          >
            {closed ? "Reopen" : "Close"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            aria-label={`Delete goal ${goal.title}`}
            onClick={onDelete}
          >
            Delete
          </Button>
        </>
      ) : null}
    </div>
  );
}
