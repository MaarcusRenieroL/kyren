"use client";

import { BellRingIcon, BookmarkIcon, PinIcon } from "lucide-react";
import { messageTime, untilLabel } from "../message-body";
import type { MessageView } from "./message-item-types";

type MessageHeaderProps = {
  message: MessageView;
  authorName: string;
};

export function MessageHeader({ message, authorName }: MessageHeaderProps) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-[15px] font-semibold">{authorName}</span>
      {message.author?.status?.emoji ? (
        <span
          title={message.author.status.text ?? undefined}
          aria-label={message.author.status.text ?? "Status"}
          className="text-sm"
        >
          {message.author.status.emoji}
        </span>
      ) : null}
      <time
        dateTime={new Date(message.createdAt).toISOString()}
        className="font-mono text-[11px] text-ink-3"
      >
        {messageTime(message.createdAt)}
      </time>
      {message.pinned ? (
        <PinIcon className="size-3 text-ink-3" aria-label="Pinned" />
      ) : null}
      {message.saved ? (
        <span
          className="flex items-center gap-1 text-[11px] text-signal-strong"
          title={
            message.saved.remindAt
              ? `Reminder ${untilLabel(message.saved.remindAt)}`
              : "Saved for later"
          }
        >
          {message.saved.remindAt ? (
            <BellRingIcon className="size-3" aria-hidden="true" />
          ) : (
            <BookmarkIcon className="size-3 fill-current" aria-hidden="true" />
          )}
          <span className="sr-only">Saved</span>
        </span>
      ) : null}
    </div>
  );
}
