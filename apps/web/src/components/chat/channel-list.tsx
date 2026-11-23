"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BellOffIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  SmileIcon,
} from "lucide-react";

import { cn } from "@zentro/ui/lib/utils";
import { Button } from "@zentro/ui/shadcn/button";
import { Skeleton } from "@zentro/ui/shadcn/skeleton";

import { StatusDialog } from "./chat-dialogs-extra";
import { useChatSidebar, type SidebarChannel } from "./chat-store";
import { channelHref, ChannelRow, row } from "./channel-list/channel-row";
import { Group } from "./channel-list/channel-group";
import { SidebarNavLinks } from "./channel-list/sidebar-nav-links";

export { channelHref };

/** The left column of Chat: places to go, then the person's conversations. */
export function ChannelList({
  onNewChannel,
  onNewDm,
  onBrowse,
}: {
  onNewChannel: () => void;
  onNewDm: () => void;
  onBrowse: () => void;
}) {
  const pathname = usePathname();
  const { data, error, refresh } = useChatSidebar();
  const [statusOpen, setStatusOpen] = useState(false);
  const extras = data?.extras;
  const channels = data?.channels ?? [];
  const live = channels.filter((channel) => !channel.archived);
  const pinned = live.filter((channel) => channel.pinned);
  const rest = live.filter((channel) => !channel.pinned);
  const discussion = rest.filter(
    (channel) =>
      channel.kind === "channel" &&
      (channel.link?.type === "task" || channel.link?.type === "doc"),
  );
  const team = rest.filter(
    (channel) =>
      channel.kind === "channel" &&
      channel.link?.type !== "project" &&
      channel.link?.type !== "task" &&
      channel.link?.type !== "doc",
  );
  const project = rest.filter(
    (channel) => channel.kind === "channel" && channel.link?.type === "project",
  );
  const dms = rest.filter((channel) => channel.kind === "dm");
  const archived = channels.filter((channel) => channel.archived);
  const mentionTotal = channels.reduce(
    (total, channel) => total + (channel.muted ? 0 : channel.mentions),
    0,
  );
  const isActive = (channel: SidebarChannel) =>
    pathname === channelHref(channel);

  const plus = (label: string, onClick: () => void) => (
    <Button
      variant="ghost"
      size="icon-sm"
      className="size-6"
      aria-label={label}
      onClick={onClick}
    >
      <PlusIcon className="size-3.5" />
    </Button>
  );

  return (
    <nav aria-label="Conversations" className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-1 px-3 pt-3 pb-2">
        <h1 className="font-display flex-1 text-[22px] leading-7">Chat</h1>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={
            data?.dnd ? "Status: do not disturb is on" : "Set your status"
          }
          title="Status and do not disturb"
          onClick={() => setStatusOpen(true)}
        >
          {data?.dnd ? (
            <BellOffIcon className="size-4 text-danger-text" />
          ) : (
            <SmileIcon className="size-4" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="New direct message"
          onClick={onNewDm}
        >
          <PencilIcon className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="New channel"
          onClick={onNewChannel}
        >
          <PlusIcon className="size-4" />
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2 pb-4">
        <SidebarNavLinks mentionTotal={mentionTotal} extras={extras} />

        {!data && !error ? (
          <div className="flex flex-col gap-2 px-2 pt-5" aria-busy="true">
            {[60, 44, 52, 38, 56].map((width) => (
              <Skeleton
                key={width}
                className="h-4"
                style={{ width: `${width}%` }}
              />
            ))}
          </div>
        ) : null}

        {error && !data ? (
          <div className="px-2 pt-5 text-[13px] text-ink-2">
            Couldn’t load your conversations.{" "}
            <Button
              variant="custom"
              type="button"
              onClick={() => void refresh()}
              className="text-signal-strong underline underline-offset-2"
            >
              Try again
            </Button>
          </div>
        ) : null}

        {pinned.length ? (
          <Group label="Pinned">
            {pinned.map((channel) => (
              <ChannelRow
                key={channel.id}
                channel={channel}
                active={isActive(channel)}
              />
            ))}
          </Group>
        ) : null}

        {data ? (
          <>
            <Group
              label="Team channels"
              action={plus("New channel", onNewChannel)}
            >
              {team.map((channel) => (
                <ChannelRow
                  key={channel.id}
                  channel={channel}
                  active={isActive(channel)}
                />
              ))}
              <Button
                variant="custom"
                type="button"
                onClick={onBrowse}
                className={cn(row, "text-ink-3 hover:bg-hover hover:text-ink")}
              >
                <SearchIcon className="size-3.5" aria-hidden="true" />
                Browse channels
              </Button>
            </Group>

            {project.length ? (
              <Group
                label="Project channels"
                action={plus("New channel", onNewChannel)}
              >
                {project.map((channel) => (
                  <ChannelRow
                    key={channel.id}
                    channel={channel}
                    active={isActive(channel)}
                  />
                ))}
              </Group>
            ) : null}

            {discussion.length ? (
              <Group label="Discussions">
                {discussion.map((channel) => (
                  <ChannelRow
                    key={channel.id}
                    channel={channel}
                    active={isActive(channel)}
                  />
                ))}
              </Group>
            ) : null}

            <Group
              label="Direct messages"
              action={plus("New direct message", onNewDm)}
            >
              {dms.length ? (
                dms.map((channel) => (
                  <ChannelRow
                    key={channel.id}
                    channel={channel}
                    active={isActive(channel)}
                  />
                ))
              ) : (
                <p className="px-2 py-1 text-[13px] text-ink-3">
                  Message someone directly.
                </p>
              )}
            </Group>

            {archived.length ? (
              <Group label="Archived">
                {archived.map((channel) => (
                  <ChannelRow
                    key={channel.id}
                    channel={channel}
                    active={isActive(channel)}
                  />
                ))}
              </Group>
            ) : null}
          </>
        ) : null}
      </div>
      {statusOpen ? (
        <StatusDialog onClose={() => setStatusOpen(false)} />
      ) : null}
    </nav>
  );
}
