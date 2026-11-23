"use client";

import { ArchiveIcon } from "lucide-react";
import { useTrpcClient } from "@kyren/api/react";
import { Button } from "@kyren/ui/shadcn/button";

import type { ChannelData } from "../channel-view";

export function ArchiveTab({
  channel,
  canManage,
  busy,
  call,
}: {
  channel: ChannelData;
  canManage: boolean;
  busy: boolean;
  call: (action: () => Promise<unknown>, done?: string) => Promise<void>;
}) {
  const trpc = useTrpcClient();

  return (
    <div className="flex items-start gap-4 rounded-lg border border-hairline p-4">
      <div className="flex-1">
        <h3 className="font-semibold">
          {channel.archivedAt ? "Restore" : "Archive"} #{channel.name}
        </h3>
        <p className="mt-1 text-[13px] text-ink-2">
          {channel.archivedAt
            ? "Opens the channel again so people can post."
            : "Hides it from the list and makes it read-only. Messages, files and task links are kept."}
        </p>
      </div>
      {canManage ? (
        <Button
          variant="outline"
          className={channel.archivedAt ? undefined : "text-danger-text"}
          disabled={busy}
          onClick={() =>
            void call(
              () =>
                trpc.chat.archive.mutate({
                  channelId: channel.id,
                  archived: !channel.archivedAt,
                }),
              channel.archivedAt ? "Channel restored" : "Channel archived",
            )
          }
        >
          <ArchiveIcon />
          {channel.archivedAt ? "Restore channel" : "Archive channel"}
        </Button>
      ) : (
        <span className="text-[13px] text-ink-3">Channel admins only</span>
      )}
    </div>
  );
}
