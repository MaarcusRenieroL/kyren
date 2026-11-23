"use client";

import { Button } from "@zentro/ui/shadcn/button";
import { useTrpcClient } from "@zentro/api/react";
import { cn } from "@zentro/ui/lib/utils";

import type { ChannelData } from "../channel-view";

export function NotificationsTab({
  channel,
  busy,
  call,
}: {
  channel: ChannelData;
  busy: boolean;
  call: (action: () => Promise<unknown>, done?: string) => Promise<void>;
}) {
  const trpc = useTrpcClient();

  return (
    <div className="flex flex-col gap-3">
      <p className="eyebrow">Your notifications</p>
      <div
        role="radiogroup"
        aria-label="Notify me about"
        className="flex w-fit gap-1 rounded-lg border border-hairline bg-sunken p-1"
      >
        {(
          [
            ["all", "All new messages"],
            ["mentions", "Mentions only"],
            ["mute", "Mute"],
          ] as const
        ).map(([value, label]) => (
          <Button
            variant="custom"
            key={value}
            type="button"
            role="radio"
            aria-checked={channel.notify === value}
            disabled={busy || !channel.joined}
            onClick={() =>
              void call(() =>
                trpc.chat.setPreferences.mutate({
                  channelId: channel.id,
                  notify: value,
                }),
              )
            }
            className={cn(
              "rounded-md px-3 py-1.5 text-sm",
              channel.notify === value
                ? "bg-surface font-medium shadow-sm"
                : "text-ink-2 hover:text-ink",
            )}
          >
            {label}
          </Button>
        ))}
      </div>
      <p className="text-[13px] text-ink-2">
        Mentions always reach you, even when a channel is muted: they land in
        Mentions.
      </p>
    </div>
  );
}
