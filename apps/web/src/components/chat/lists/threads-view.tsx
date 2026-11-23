"use client";

import { useCallback, useEffect, useState } from "react";
import { MessageSquareIcon } from "lucide-react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@kyren/api/server";
import { useTrpcClient } from "@kyren/api/react";
import { cn } from "@kyren/ui/lib/utils";
import { toastError } from "@kyren/ui/index";
import { Button } from "@kyren/ui/shadcn/button";
import { useChatSidebar } from "../chat-store";
import { MessageBody, relativeAgo } from "../message-body";
import { Avatar } from "../message-item";
import {
  above,
  JumpRow,
  ListEmpty,
  ListPage,
  ListSkeleton,
  Tabs,
  where,
} from "./list-primitives";

type Outputs = inferRouterOutputs<AppRouter>["chat"];
type ThreadItem = Outputs["threads"][number];

/** Threads you follow, newest activity first. */
export function ThreadsView() {
  const trpc = useTrpcClient();
  const sidebar = useChatSidebar();
  const [items, setItems] = useState<ThreadItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState<"all" | "unread">("all");

  const load = useCallback(async () => {
    try {
      setItems(await trpc.chat.threads.query());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [trpc]);

  useEffect(() => {
    void load();
  }, [load]);

  const unread = items?.filter((item) => item.unread) ?? [];
  const shown = (tab === "unread" ? unread : items) ?? [];

  const markAll = async () => {
    try {
      await Promise.all(
        unread.map((item) =>
          trpc.chat.markThreadRead.mutate({ parentId: item.message.id }),
        ),
      );
      await Promise.all([load(), sidebar.refresh()]);
    } catch (error) {
      toastError(error, "Could not mark them read");
    }
  };

  return (
    <ListPage
      icon={<MessageSquareIcon className="size-4" aria-hidden="true" />}
      title="Threads"
      count={unread.length ? `${unread.length} unread` : undefined}
      actions={
        <Button
          variant="outline"
          disabled={!unread.length}
          onClick={() => void markAll()}
        >
          Mark all read
        </Button>
      }
    >
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          ["all", "All", items?.length ?? 0],
          ["unread", "Unread", unread.length],
        ]}
      />

      {items === null && !failed ? <ListSkeleton /> : null}
      {failed && !items ? (
        <p className="pt-8 text-center text-[15px] text-ink-2">
          Couldn’t load your threads.{" "}
          <Button
            variant="custom"
            type="button"
            onClick={() => void load()}
            className="text-signal-strong underline underline-offset-2"
          >
            Try again
          </Button>
        </p>
      ) : null}
      {items && !shown.length ? (
        <ListEmpty
          title={tab === "unread" ? "No unread threads." : "No threads yet."}
          hint="Threads you start, reply in, or follow show up here with what’s new."
        />
      ) : null}

      <div className="flex flex-col pt-3">
        {shown.map((item) => (
          <JumpRow
            key={item.message.id}
            href={`${where(item.channelName, item.message.channelId)}?m=${item.message.id}&thread=${item.message.id}`}
            label={`Open thread by ${item.message.author?.name ?? "someone"}`}
          >
            <span
              aria-hidden="true"
              className={cn(
                "mt-3 size-[7px] shrink-0 rounded-full",
                item.unread ? "bg-ink" : "bg-transparent",
              )}
            />
            <Avatar name={item.message.author?.name ?? "Someone"} size={32} />
            <div className="pointer-events-none min-w-0 flex-1">
              <p className="text-sm">
                <span className="font-semibold">
                  {item.message.author?.name}
                </span>{" "}
                <span className="text-ink-2">in</span>{" "}
                <span className="font-mono text-[13px] text-signal-strong">
                  {item.channelName
                    ? `#${item.channelName}`
                    : "a direct message"}
                </span>
              </p>
              <div className={cn("line-clamp-2 text-[15px] leading-6", above)}>
                <MessageBody
                  body={item.message.body || "Attachment"}
                  names={item.message.names}
                />
              </div>
              <p className="mt-0.5 font-mono text-[11px] text-ink-3">
                {item.message.replies?.count ?? 0}{" "}
                {(item.message.replies?.count ?? 0) === 1 ? "reply" : "replies"}{" "}
                · last {relativeAgo(item.lastAt)}
                {item.unread ? (
                  <span className="ml-2 rounded-full bg-ink px-1.5 text-ink-inverse">
                    {item.unread} new
                  </span>
                ) : null}
              </p>
            </div>
          </JumpRow>
        ))}
      </div>
    </ListPage>
  );
}
