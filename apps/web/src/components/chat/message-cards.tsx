"use client";

import Link from "next/link";
import {
  CornerUpRightIcon,
  ExternalLinkIcon,
  FileIcon,
  FileTextIcon,
  FolderKanbanIcon,
  LockIcon,
  MessageSquareIcon,
  VideoIcon,
} from "lucide-react";

import { cn } from "@zentro/ui/lib/utils";
import { Button } from "@zentro/ui/shadcn/button";

import type { MessageView } from "./message-item";

export { PollCard } from "./poll-card";

const cardBase =
  "mt-1.5 flex max-w-md items-center gap-2.5 rounded-lg border border-hairline bg-surface px-3 py-2 outline-none hover:border-ink-3 focus-visible:ring-2 focus-visible:ring-ring";

/** A doc, project or file a message links to. */
export function EntityCard({
  entity,
}: {
  entity: MessageView["entities"][number];
}) {
  if (entity.type === "missing") {
    // The viewer cannot open it; nothing about it is shown.
    return (
      <div
        className={cn(
          cardBase,
          "cursor-default text-ink-3 hover:border-hairline",
        )}
      >
        <LockIcon className="size-4 shrink-0" aria-hidden="true" />
        <span className="text-sm">You don’t have access to this link.</span>
      </div>
    );
  }

  if (entity.type === "message") {
    // A link to another message: who said it, where, and the start of it.
    return (
      <Link
        href={entity.href}
        className={cn(cardBase, "items-start border-l-2 border-l-signal")}
      >
        <MessageSquareIcon
          className="mt-0.5 size-4 shrink-0 text-ink-3"
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-mono text-[11px] text-ink-3">
            {entity.title} · {entity.subtitle}
          </span>
          <span className="line-clamp-2 text-sm">{entity.excerpt}</span>
        </span>
      </Link>
    );
  }

  const Icon =
    entity.type === "doc"
      ? FileTextIcon
      : entity.type === "project"
        ? FolderKanbanIcon
        : FileIcon;
  const external = entity.type === "file";

  const content = (
    <>
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-md",
          entity.type === "doc"
            ? "bg-tint-docs"
            : entity.type === "project"
              ? "bg-tint-projects"
              : "bg-sunken",
        )}
      >
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">
          {entity.title}
        </span>
        <span className="block truncate font-mono text-[11px] text-ink-3">
          {entity.subtitle}
          {entity.type === "project" && entity.status !== "active"
            ? ` · ${entity.status}`
            : ""}
        </span>
      </span>
    </>
  );

  return external ? (
    <a
      href={entity.href}
      target="_blank"
      rel="noreferrer noopener"
      className={cardBase}
    >
      {content}
      <ExternalLinkIcon className="size-3.5 text-ink-3" aria-hidden="true" />
    </a>
  ) : (
    <Link href={entity.href} className={cardBase}>
      {content}
    </Link>
  );
}

/** An external page's title, blurb and image. */
export function LinkPreviewCard({
  link,
}: {
  link: MessageView["links"][number];
}) {
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noreferrer noopener"
      className="mt-1.5 flex max-w-md overflow-hidden rounded-lg border border-hairline bg-surface outline-none hover:border-ink-3 focus-visible:ring-2 focus-visible:ring-ring"
    >
      {link.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={link.image}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="size-20 shrink-0 object-cover"
        />
      ) : null}
      <span className="flex min-w-0 flex-1 flex-col justify-center px-3 py-2">
        <span className="truncate font-mono text-[11px] text-ink-3">
          {link.siteName}
        </span>
        <span className="line-clamp-1 text-sm font-semibold">{link.title}</span>
        {link.description ? (
          <span className="line-clamp-2 text-[13px] text-ink-2">
            {link.description}
          </span>
        ) : null}
      </span>
    </a>
  );
}

/** The origin of a forwarded message. */
export function ForwardedBlock({
  forwarded,
}: {
  forwarded: NonNullable<MessageView["forwarded"]>;
}) {
  const href = `/chat/${forwarded.channelName ?? "dm"}?m=${forwarded.id}`;

  return (
    <Link
      href={
        forwarded.channelName
          ? href
          : `/chat/dm/${forwarded.channelId}?m=${forwarded.id}`
      }
      className="mt-1.5 flex max-w-md gap-2 rounded-lg border-l-2 border-line-strong bg-sunken/60 px-3 py-2 outline-none hover:bg-sunken focus-visible:ring-2 focus-visible:ring-ring"
    >
      <CornerUpRightIcon
        className="mt-0.5 size-3.5 shrink-0 text-ink-3"
        aria-hidden="true"
      />
      <span className="min-w-0">
        <span className="block font-mono text-[11px] text-ink-3">
          Forwarded from {forwarded.authorName}
          {forwarded.channelName ? ` in #${forwarded.channelName}` : ""}
        </span>
        <span className="line-clamp-3 text-sm text-ink-2">
          {forwarded.excerpt}
        </span>
      </span>
    </Link>
  );
}

/** A huddle started in the conversation. */
export function HuddleCard({ url }: { url: string }) {
  return (
    <div className="mt-1.5 flex max-w-md items-center gap-3 rounded-lg border border-hairline bg-surface px-3 py-2.5">
      <span className="flex size-9 items-center justify-center rounded-md bg-tint-teams">
        <VideoIcon className="size-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">Huddle</span>
        <span className="block font-mono text-[11px] text-ink-3">
          Video room · opens in a new tab
        </span>
      </span>
      <Button asChild size="sm">
        <a href={url} target="_blank" rel="noreferrer noopener">
          Join
        </a>
      </Button>
    </div>
  );
}
