"use client";

import { Label } from "@kyren/ui/shadcn/label";
import { Checkbox } from "@kyren/ui/shadcn/checkbox";
import { useEffect, useState } from "react";
import { DownloadIcon } from "lucide-react";
import { useTrpcClient } from "@kyren/api/react";
import { toastError, toastSuccess } from "@kyren/ui/index";
import { Button } from "@kyren/ui/shadcn/button";
import { NativeSelect } from "@kyren/ui/shadcn/native-select";

import type { ChannelData } from "../channel-view";

const feedEvents = [
  ["created", "A task is created"],
  ["done", "A task is marked done"],
  ["assigned", "A task is assigned"],
  ["overdue", "A task becomes overdue"],
] as const;

export function DataTab({
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
  const [feed, setFeed] = useState<{
    enabled: boolean;
    events: string[];
  } | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (channel.link?.type !== "project") return;

    let live = true;

    trpc.chat.feedGet
      .query({ channelId: channel.id })
      .then((data) => live && setFeed(data))
      .catch(() => undefined);

    return () => {
      live = false;
    };
  }, [trpc, channel.id, channel.link?.type]);

  const exportChannel = async () => {
    setExporting(true);

    try {
      const data = await trpc.chat.exportChannel.query({
        channelId: channel.id,
      });
      const text = data.messages
        .map(
          (message) =>
            `[${new Date(message.at).toISOString()}] ${message.inThread ? "  ↳ " : ""}${message.author}: ${message.text}`,
        )
        .join("\n");
      const url = URL.createObjectURL(
        new Blob([`# ${data.channel}\n\n${text}\n`], { type: "text/plain" }),
      );
      const anchor = document.createElement("a");

      anchor.href = url;
      anchor.download = `${data.channel}-${new Date().toISOString().slice(0, 10)}.txt`;
      anchor.click();
      URL.revokeObjectURL(url);
      toastSuccess(`Exported ${data.messages.length} messages`);
    } catch (error) {
      toastError(error, "Could not export the channel");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-2">
        <h3 className="font-semibold">Activity feed</h3>
        {channel.link?.type === "project" ? (
          <>
            <p className="text-[13px] text-ink-2">
              Post what happens to {channel.link.name}’s tasks into this
              channel.
            </p>
            <Label className="flex items-center gap-2.5 text-sm">
              <Checkbox
                disabled={!canManage || busy || !feed}
                checked={feed?.enabled ?? false}
                onCheckedChange={(checked) => {
                  const next = {
                    enabled: checked === true,
                    events: feed?.events.length
                      ? feed.events
                      : ["created", "done"],
                  };

                  setFeed(next);
                  void call(
                    () =>
                      trpc.chat.feedSet.mutate({
                        channelId: channel.id,
                        enabled: next.enabled,
                        events: next.events as Array<
                          "created" | "done" | "assigned" | "overdue"
                        >,
                      }),
                    next.enabled ? "Activity feed on" : "Activity feed off",
                  );
                }}
                className="size-4 accent-[var(--signal)]"
              />
              Send task activity here
            </Label>
            {feed?.enabled ? (
              <div className="flex flex-col gap-1.5 pl-6">
                {feedEvents.map(([event, label]) => (
                  <Label
                    key={event}
                    className="flex items-center gap-2.5 text-sm"
                  >
                    <Checkbox
                      disabled={!canManage || busy}
                      checked={feed.events.includes(event)}
                      onCheckedChange={(checked) => {
                        const events =
                          checked === true
                            ? [...feed.events, event]
                            : feed.events.filter((entry) => entry !== event);

                        setFeed({ enabled: true, events });
                        void call(() =>
                          trpc.chat.feedSet.mutate({
                            channelId: channel.id,
                            enabled: true,
                            events: events as Array<
                              "created" | "done" | "assigned" | "overdue"
                            >,
                          }),
                        );
                      }}
                      className="size-4 accent-[var(--signal)]"
                    />
                    {label}
                  </Label>
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <p className="text-[13px] text-ink-3">
            Link this channel to a project to receive its task activity.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-2 border-t border-hairline pt-4">
        <h3 className="font-semibold">Keep messages for</h3>
        <p className="text-[13px] text-ink-2">
          Older messages are deleted every night. Pinned messages are always
          kept.
        </p>
        <NativeSelect
          aria-label="Retention"
          size="sm"
          className="w-36 text-sm"
          disabled={!canManage || busy}
          value={channel.retentionDays ? String(channel.retentionDays) : ""}
          onChange={(event) =>
            void call(
              () =>
                trpc.chat.setRetention.mutate({
                  channelId: channel.id,
                  days: event.target.value ? Number(event.target.value) : null,
                }),
              "Retention updated",
            )
          }
        >
          <option value="">Forever</option>
          <option value="30">30 days</option>
          <option value="90">90 days</option>
          <option value="365">1 year</option>
        </NativeSelect>
        {!canManage ? (
          <p className="text-[13px] text-ink-3">Channel admins only.</p>
        ) : null}
      </section>

      <section className="flex flex-col gap-2 border-t border-hairline pt-4">
        <h3 className="font-semibold">Export</h3>
        <p className="text-[13px] text-ink-2">
          Download every message in this channel as a text file.
        </p>
        <Button
          variant="outline"
          className="w-fit"
          disabled={!canManage || busy || exporting}
          onClick={() => void exportChannel()}
        >
          <DownloadIcon />
          Export messages
        </Button>
      </section>
    </div>
  );
}
