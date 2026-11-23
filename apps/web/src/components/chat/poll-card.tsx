"use client";

import { Button } from "@zentro/ui/shadcn/button";
import { BarChart3Icon, CheckIcon } from "lucide-react";
import { cn } from "@zentro/ui/lib/utils";
import type { MessageView } from "./message-item";

/** A poll: options with live counts, who voted, and a close button. */
export function PollCard({
  poll,
  canVote,
  canClose,
  onVote,
  onClose,
}: {
  poll: NonNullable<MessageView["poll"]>;
  canVote: boolean;
  canClose: boolean;
  onVote: (index: number) => void;
  onClose: () => void;
}) {
  return (
    <div className="mt-1.5 flex max-w-md flex-col gap-2 rounded-lg border border-hairline bg-surface p-3">
      <div className="flex items-start gap-2">
        <BarChart3Icon
          className="mt-0.5 size-4 shrink-0 text-ink-3"
          aria-hidden="true"
        />
        <p className="flex-1 text-[15px] leading-6 font-semibold">
          {poll.question}
        </p>
        {poll.closed ? (
          <span className="rounded-sm border border-hairline px-1.5 font-mono text-[10px] text-ink-2 uppercase">
            Closed
          </span>
        ) : null}
      </div>
      <ul className="flex flex-col gap-1.5">
        {poll.options.map((option, index) => {
          const share = poll.total
            ? Math.round((option.votes / poll.total) * 100)
            : 0;

          return (
            <li key={index}>
              <Button
                variant="custom"
                type="button"
                disabled={!canVote || poll.closed}
                onClick={() => onVote(index)}
                aria-pressed={option.mine}
                title={option.voters.join(", ")}
                className={cn(
                  "relative flex w-full items-center gap-2 overflow-hidden rounded-md border px-2.5 py-1.5 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  option.mine ? "border-signal" : "border-hairline",
                  canVote && !poll.closed && "hover:border-ink-3",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute inset-y-0 left-0",
                    option.mine ? "bg-signal-subtle" : "bg-sunken",
                  )}
                  style={{ width: `${share}%` }}
                />
                <span className="relative flex flex-1 items-center gap-1.5">
                  {option.mine ? (
                    <CheckIcon
                      className="size-3.5 text-signal-strong"
                      aria-hidden="true"
                    />
                  ) : null}
                  {option.label}
                </span>
                <span className="relative font-mono text-xs text-ink-2">
                  {option.votes} · {share}%
                </span>
              </Button>
            </li>
          );
        })}
      </ul>
      <div className="flex items-center justify-between font-mono text-[11px] text-ink-3">
        <span>
          {poll.total} {poll.total === 1 ? "vote" : "votes"}
          {poll.multiple ? " · pick several" : ""}
        </span>
        {canClose && !poll.closed ? (
          <Button
            variant="custom"
            type="button"
            onClick={onClose}
            className="underline underline-offset-2 hover:text-ink"
          >
            Close poll
          </Button>
        ) : null}
      </div>
    </div>
  );
}
