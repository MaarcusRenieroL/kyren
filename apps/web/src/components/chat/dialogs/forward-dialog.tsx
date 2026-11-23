"use client";

import { Button } from "@kyren/ui/shadcn/button";
import { useMemo, useState } from "react";
import { HashIcon, LockIcon } from "lucide-react";
import { useTrpcClient } from "@kyren/api/react";
import { toastError, toastSuccess } from "@kyren/ui/index";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@kyren/ui/shadcn/dialog";
import { Input } from "@kyren/ui/shadcn/input";

import { useChatSidebar } from "../chat-store";
import { Avatar, type MessageView } from "../message-item";

/** Pick a conversation to forward a message to, with an optional note. */
export function ForwardDialog({
  message,
  onClose,
}: {
  message: MessageView;
  onClose: () => void;
}) {
  const trpc = useTrpcClient();
  const { data } = useChatSidebar();
  const [query, setQuery] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState<string | null>(null);
  const channels = useMemo(
    () =>
      (data?.channels ?? [])
        .filter((channel) => !channel.archived)
        .filter((channel) =>
          channel.title.toLowerCase().includes(query.trim().toLowerCase()),
        ),
    [data, query],
  );

  const forward = async (channelId: string, title: string) => {
    setSending(channelId);

    try {
      await trpc.chat.forward.mutate({
        messageId: message.id,
        channelId,
        note: note.trim(),
      });
      toastSuccess(`Forwarded to ${title}`);
      onClose();
    } catch (error) {
      toastError(error, "Could not forward the message");
      setSending(null);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="gap-4 sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="text-xl">Forward message</DialogTitle>
          <DialogDescription className="line-clamp-2">
            {message.body.replace(/<@[0-9a-f-]{36}>/g, "@someone") ||
              "Attachment"}
          </DialogDescription>
        </DialogHeader>
        <Input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Find a channel or person…"
          aria-label="Find a conversation"
        />
        <ul
          className="flex max-h-56 flex-col gap-0.5 overflow-y-auto"
          aria-label="Conversations"
        >
          {channels.map((channel) => (
            <li key={channel.id}>
              <Button
                variant="custom"
                type="button"
                disabled={sending !== null}
                onClick={() => void forward(channel.id, channel.title)}
                className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-hover disabled:opacity-60"
              >
                {channel.kind === "dm" ? (
                  <Avatar
                    name={channel.people[0]?.name ?? channel.title}
                    size={20}
                  />
                ) : channel.visibility === "private" ? (
                  <LockIcon className="size-4 text-ink-3" aria-hidden="true" />
                ) : (
                  <HashIcon className="size-4 text-ink-3" aria-hidden="true" />
                )}
                <span className="flex-1 truncate">{channel.title}</span>
                <span className="font-mono text-[11px] text-ink-3">
                  {sending === channel.id ? "Sending…" : "Forward"}
                </span>
              </Button>
            </li>
          ))}
          {!channels.length ? (
            <li className="px-2 py-3 text-sm text-ink-3">
              No conversation matches.
            </li>
          ) : null}
        </ul>
        <Input
          value={note}
          maxLength={2000}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Add a note (optional)"
          aria-label="Note"
        />
      </DialogContent>
    </Dialog>
  );
}
