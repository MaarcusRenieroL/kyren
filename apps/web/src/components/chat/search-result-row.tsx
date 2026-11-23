"use client";

import Link from "next/link";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@kyren/api/server";

import { MessageBody, relativeAgo } from "./message-body";
import { Avatar } from "./message-item";

export type SearchResult =
  inferRouterOutputs<AppRouter>["chat"]["search"]["results"][number];

export function SearchResultRow({
  result,
  words,
}: {
  result: SearchResult;
  words: string[];
}) {
  return (
    <div className="group relative flex gap-3 rounded-lg px-3 py-2.5 hover:bg-hover">
      <Link
        href={`${result.channel.name ? `/chat/${result.channel.name}` : `/chat/dm/${result.channelId}`}?m=${result.id}`}
        className="absolute inset-0 rounded-lg"
        aria-label={`Jump to message from ${result.author?.name ?? "someone"}`}
      />
      <Avatar name={result.author?.name ?? "Someone"} size={30} />
      <div className="min-w-0 flex-1">
        <p className="text-sm">
          <span className="font-semibold">{result.author?.name}</span>{" "}
          <span className="font-mono text-[11px] text-ink-3">
            {relativeAgo(result.createdAt)}
          </span>
        </p>
        <div className="pointer-events-none line-clamp-2 text-[15px] leading-6 [&_a]:pointer-events-auto [&_a]:relative">
          <MessageBody
            body={result.body}
            names={result.names}
            highlight={words}
          />
        </div>
      </div>
      <span className="pointer-events-none self-center font-mono text-xs text-ink-3 opacity-0 group-hover:opacity-100">
        Jump
      </span>
    </div>
  );
}
