"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AtSignIcon, NewspaperIcon } from "lucide-react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@kyren/api/server";
import { useTrpcClient } from "@kyren/api/react";
import { toastError } from "@kyren/ui/index";
import { Button } from "@kyren/ui/shadcn/button";
import { SummaryDialog } from "../chat-dialogs-extra";
import { useChatSidebar } from "../chat-store";
import { ListEmpty, ListPage, ListSkeleton, where } from "./list-primitives";

type Outputs = inferRouterOutputs<AppRouter>["chat"];
type CatchUpItem = Outputs["catchUp"][number];

/** What happened in the conversations you were away from. */
export function CatchUpView() {
  const trpc = useTrpcClient();
  const sidebar = useChatSidebar();
  const [items, setItems] = useState<CatchUpItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [summarize, setSummarize] = useState<CatchUpItem | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await trpc.chat.catchUp.query());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [trpc]);

  useEffect(() => {
    void load();
  }, [load]);

  const markRead = async (channelIds: string[]) => {
    try {
      await Promise.all(
        channelIds.map((channelId) => trpc.chat.markRead.mutate({ channelId })),
      );
      await Promise.all([load(), sidebar.refresh()]);
    } catch (error) {
      toastError(error, "Could not mark it read");
    }
  };

  return (
    <ListPage
      icon={<NewspaperIcon className="size-4" aria-hidden="true" />}
      title="Catch up"
      count={items?.length ? `${items.length} with news` : undefined}
      actions={
        <Button
          variant="outline"
          disabled={!items?.length}
          onClick={() =>
            void markRead(items?.map((item) => item.channelId) ?? [])
          }
        >
          Mark all read
        </Button>
      }
    >
      {items === null && !failed ? <ListSkeleton /> : null}
      {failed && !items ? (
        <p className="pt-8 text-center text-[15px] text-ink-2">
          Couldn’t load the digest.{" "}
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
      {items && !items.length ? (
        <ListEmpty
          title="You’re all caught up."
          hint="When conversations you’re in get new messages, a short digest of each shows here."
        />
      ) : null}

      <div className="grid gap-3 pt-5 lg:grid-cols-2">
        {items?.map((item) => (
          <article
            key={item.channelId}
            className="flex flex-col gap-2 rounded-xl border border-hairline bg-surface p-4"
          >
            <header className="flex items-center gap-2">
              <Link
                href={where(item.channelName, item.channelId)}
                className="min-w-0 flex-1 truncate font-semibold hover:underline"
              >
                {item.channelName ? `#${item.channelName}` : "Direct message"}
              </Link>
              {item.mentions ? (
                <span className="flex items-center gap-1 rounded-full bg-ink px-2 font-mono text-[11px] text-ink-inverse">
                  <AtSignIcon className="size-3" aria-hidden="true" />
                  {item.mentions}
                </span>
              ) : null}
              <span className="font-mono text-xs text-ink-2">
                {item.count} new
              </span>
            </header>
            <p className="text-[13px] text-ink-2">
              From {item.people.join(", ")}
            </p>
            <p className="line-clamp-2 text-[15px] leading-6">{item.latest}</p>
            {item.tasks.length ? (
              <p className="flex flex-wrap gap-1.5">
                {item.tasks.map((key) => (
                  <Link
                    key={key}
                    href={`/tasks/${key}`}
                    className="rounded-xs border border-hairline px-1.5 font-mono text-[11px] text-ink-2 hover:text-ink"
                  >
                    {key}
                  </Link>
                ))}
              </p>
            ) : null}
            <footer className="mt-1 flex items-center gap-2">
              <Button asChild size="sm">
                <Link href={where(item.channelName, item.channelId)}>Open</Link>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSummarize(item)}
              >
                Summarize
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void markRead([item.channelId])}
              >
                Mark read
              </Button>
            </footer>
          </article>
        ))}
      </div>

      {summarize ? (
        <SummaryDialog
          channelId={summarize.channelId}
          title={
            summarize.channelName
              ? `#${summarize.channelName}`
              : "Direct message"
          }
          onClose={() => setSummarize(null)}
        />
      ) : null}
    </ListPage>
  );
}
