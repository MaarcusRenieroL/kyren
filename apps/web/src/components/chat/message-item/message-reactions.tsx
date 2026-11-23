"use client";

import { Button } from "@kyren/ui/shadcn/button";
import { SmilePlusIcon } from "lucide-react";
import { cn } from "@kyren/ui/lib/utils";
import { ReactionPicker } from "./message-reaction-picker";
import type { MessageActions, MessageView } from "./message-item-types";

type MessageReactionsProps = {
  message: MessageView;
  canPost: boolean;
  actions: MessageActions;
  setToolbarPinned: (pinned: boolean) => void;
};

export function MessageReactions({
  message,
  canPost,
  actions,
  setToolbarPinned,
}: MessageReactionsProps) {
  if (!message.reactions.length) return null;

  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {message.reactions.map((reaction) => (
        <Button
          variant="custom"
          key={reaction.emoji}
          type="button"
          disabled={!canPost}
          title={reaction.names.join(", ")}
          aria-pressed={reaction.mine}
          onClick={() => actions.onReact(message, reaction.emoji)}
          className={cn(
            "flex h-6 items-center gap-1 rounded-full border px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring",
            reaction.mine
              ? "border-signal bg-signal-subtle text-ink"
              : "border-hairline bg-surface text-ink-2 hover:border-ink-3",
          )}
        >
          <span>{reaction.emoji}</span>
          <span className="font-mono">{reaction.count}</span>
        </Button>
      ))}
      {canPost ? (
        <ReactionPicker
          onPick={(value) => actions.onReact(message, value)}
          onOpenChange={setToolbarPinned}
          trigger={
            <Button
              variant="custom"
              type="button"
              aria-label="Add a reaction"
              className="flex size-6 items-center justify-center rounded-full border border-hairline text-ink-3 hover:border-ink-3 hover:text-ink"
            >
              <SmilePlusIcon className="size-3.5" />
            </Button>
          }
        />
      ) : null}
    </div>
  );
}
