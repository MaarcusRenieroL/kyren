"use client";

import { MessageSquareIcon, SmilePlusIcon } from "lucide-react";
import { cn } from "@zentro/ui/lib/utils";
import { Button } from "@zentro/ui/shadcn/button";
import { MessageActionsMenu } from "./message-actions-menu";
import { ReactionPicker } from "./message-reaction-picker";
import {
  quickReactions,
  type MessageActions,
  type MessageView,
} from "./message-item-types";

type MessageItemToolbarProps = {
  message: MessageView;
  canPost: boolean;
  canModerate: boolean;
  inThread: boolean;
  toolbarPinned: boolean;
  setToolbarPinned: (pinned: boolean) => void;
  actions: MessageActions;
  onStartEdit: () => void;
  onTranslate: (language: string) => void;
  onCopyLink: () => void;
};

export function MessageItemToolbar({
  message,
  canPost,
  canModerate,
  inThread,
  toolbarPinned,
  setToolbarPinned,
  actions,
  onStartEdit,
  onTranslate,
  onCopyLink,
}: MessageItemToolbarProps) {
  return (
    <div
      className={cn(
        "absolute -top-3 right-4 z-10 items-center rounded-md border border-hairline bg-surface p-0.5 shadow-sm group-focus-within:flex group-hover:flex",
        toolbarPinned ? "flex" : "hidden",
      )}
    >
      {canPost ? (
        <>
          {quickReactions.slice(0, 3).map((value) => (
            <Button
              variant="custom"
              key={value}
              type="button"
              aria-label={`React with ${value}`}
              onClick={() => actions.onReact(message, value)}
              className="rounded-sm px-1.5 py-1 text-sm hover:bg-hover"
            >
              {value}
            </Button>
          ))}
          <ReactionPicker
            onPick={(value) => actions.onReact(message, value)}
            onOpenChange={setToolbarPinned}
            trigger={
              <Button
                variant="ghost"
                size="icon-sm"
                className="size-7"
                aria-label="More reactions"
              >
                <SmilePlusIcon className="size-4" />
              </Button>
            }
          />
        </>
      ) : null}

      {!inThread && canPost && actions.onReply ? (
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-7"
          aria-label="Reply in thread"
          onClick={() => actions.onReply?.(message)}
        >
          <MessageSquareIcon className="size-4" />
        </Button>
      ) : null}

      <MessageActionsMenu
        message={message}
        canModerate={canModerate}
        inThread={inThread}
        actions={actions}
        onOpenChange={setToolbarPinned}
        onStartEdit={onStartEdit}
        onTranslate={onTranslate}
        onCopyLink={onCopyLink}
      />
    </div>
  );
}
