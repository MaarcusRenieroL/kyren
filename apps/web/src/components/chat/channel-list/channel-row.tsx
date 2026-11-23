"use client";

import Link from "next/link";
import { HashIcon, LockIcon } from "lucide-react";
import { cn } from "@kyren/ui/lib/utils";
import type { SidebarChannel } from "../chat-store";
import { Avatar } from "../message-item";

export function channelHref(
  channel: Pick<SidebarChannel, "kind" | "id" | "name">,
) {
  return channel.kind === "dm"
    ? `/chat/dm/${channel.id}`
    : `/chat/${channel.name}`;
}

export function Count({ value, strong }: { value: number; strong: boolean }) {
  if (!value) return null;

  return (
    <span
      className={cn(
        "ml-auto shrink-0 rounded-full px-1.5 font-mono text-[11px] leading-[18px]",
        strong ? "bg-ink text-ink-inverse" : "bg-sunken text-ink-2",
      )}
    >
      {value}
    </span>
  );
}

export const row =
  "flex h-8 items-center gap-2 rounded-md px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function ChannelRow({
  channel,
  active,
}: {
  channel: SidebarChannel;
  active: boolean;
}) {
  const unread = channel.unread > 0 && !channel.muted;
  const dm = channel.kind === "dm";
  const person = channel.people[0];

  return (
    <Link
      href={channelHref(channel)}
      aria-current={active ? "page" : undefined}
      className={cn(
        row,
        active
          ? "bg-selected font-medium text-ink"
          : unread
            ? "font-semibold text-ink hover:bg-hover"
            : "text-ink-2 hover:bg-hover hover:text-ink",
        channel.archived && "opacity-60",
      )}
    >
      {dm ? (
        channel.people.length === 1 && person ? (
          <Avatar name={person.name} presence={person.presence} size={20} />
        ) : (
          <span className="flex size-5 shrink-0 items-center justify-center rounded-sm bg-sunken font-mono text-[10px]">
            {channel.people.length + 1}
          </span>
        )
      ) : channel.visibility === "private" ? (
        <LockIcon className="size-3.5 shrink-0 text-ink-3" aria-hidden="true" />
      ) : (
        <HashIcon className="size-3.5 shrink-0 text-ink-3" aria-hidden="true" />
      )}
      <span className="min-w-0 flex-1 truncate">{channel.title}</span>
      {channel.link?.key ? (
        <span className="font-mono text-[10px] text-ink-3">
          {channel.link.key}
        </span>
      ) : null}
      <Count
        value={channel.mentions || (unread ? channel.unread : 0)}
        strong={channel.mentions > 0}
      />
    </Link>
  );
}
