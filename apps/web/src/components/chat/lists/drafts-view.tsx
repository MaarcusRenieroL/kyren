"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ClockIcon, FileEditIcon } from "lucide-react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@zentro/api/server";
import { useTrpcClient } from "@zentro/api/react";
import { toastError, toastSuccess } from "@zentro/ui/index";
import { Button } from "@zentro/ui/shadcn/button";
import { useChatSidebar } from "../chat-store";
import {
  dayHeading,
  messageTime,
  relativeAgo,
  untilLabel,
} from "../message-body";
import {
  JumpRow,
  ListEmpty,
  ListPage,
  ListSkeleton,
  where,
} from "./list-primitives";

type Outputs = inferRouterOutputs<AppRouter>["chat"];

/** Unsent drafts and messages waiting to go out. */
export function DraftsView() {
  const trpc = useTrpcClient();
  const sidebar = useChatSidebar();
  const [drafts, setDrafts] = useState<Outputs["draftList"] | null>(null);
  const [scheduled, setScheduled] = useState<Outputs["scheduledList"] | null>(
    null,
  );
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const [d, s] = await Promise.all([
        trpc.chat.draftList.query(),
        trpc.chat.scheduledList.query(),
      ]);
      setDrafts(d);
      setScheduled(s);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [trpc]);

  useEffect(() => {
    void load();
  }, [load]);

  const cancel = async (id: string) => {
    try {
      await trpc.chat.scheduledCancel.mutate({ id });
      toastSuccess("Scheduled message canceled");
      await Promise.all([load(), sidebar.refresh()]);
    } catch (error) {
      toastError(error, "Could not cancel it");
    }
  };

  const loaded = drafts !== null && scheduled !== null;

  return (
    <ListPage
      icon={<FileEditIcon className="size-4" aria-hidden="true" />}
      title="Drafts & scheduled"
    >
      {!loaded && !failed ? <ListSkeleton /> : null}
      {failed && !loaded ? (
        <p className="pt-8 text-center text-[15px] text-ink-2">
          Couldn’t load your drafts.{" "}
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
      {loaded && !drafts.length && !scheduled.length ? (
        <ListEmpty
          title="No drafts."
          hint="Anything you start typing and don’t send is kept here. Use the arrow next to Send to schedule a message."
        />
      ) : null}

      {scheduled?.length ? (
        <section className="flex flex-col pt-5">
          <h3 className="eyebrow px-3 pb-1.5">
            Scheduled · {scheduled.length}
          </h3>
          {scheduled.map((item) => (
            <div
              key={item.id}
              className="flex items-start gap-3 rounded-lg border-t border-hairline/60 px-3 py-3"
            >
              <ClockIcon
                className="mt-1 size-4 shrink-0 text-ink-3"
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <span className="text-ink-2">To</span>{" "}
                  <Link
                    href={where(item.channelName, item.channelId)}
                    className="font-mono text-[13px] text-signal-strong hover:underline"
                  >
                    {item.channelName
                      ? `#${item.channelName}`
                      : "a direct message"}
                  </Link>
                  {item.inThread ? (
                    <span className="text-ink-3"> · reply in thread</span>
                  ) : null}{" "}
                  <span className="font-mono text-[11px] text-ink-3">
                    {dayHeading(item.sendAt)} {messageTime(item.sendAt)} ·{" "}
                    {untilLabel(item.sendAt)}
                  </span>
                </p>
                <p className="line-clamp-3 text-[15px] leading-6">
                  {item.body}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void cancel(item.id)}
              >
                Cancel
              </Button>
            </div>
          ))}
        </section>
      ) : null}

      {drafts?.length ? (
        <section className="flex flex-col pt-5">
          <h3 className="eyebrow px-3 pb-1.5">Drafts · {drafts.length}</h3>
          {drafts.map((draft) => (
            <JumpRow
              key={`${draft.channelId}-${draft.inThread}-${draft.updatedAt.toString()}`}
              href={where(draft.channelName, draft.channelId)}
              label="Continue this draft"
            >
              <FileEditIcon
                className="mt-1 size-4 shrink-0 text-ink-3"
                aria-hidden="true"
              />
              <div className="pointer-events-none min-w-0 flex-1">
                <p className="text-sm">
                  <span className="text-ink-2">
                    {draft.inThread ? "Thread reply in" : "Message to"}
                  </span>{" "}
                  <span className="font-mono text-[13px] text-signal-strong">
                    {draft.channelName
                      ? `#${draft.channelName}`
                      : "a direct message"}
                  </span>{" "}
                  <span className="font-mono text-[11px] text-ink-3">
                    edited {relativeAgo(draft.updatedAt)}
                  </span>
                </p>
                <p className="line-clamp-2 text-[15px] leading-6 text-ink-2">
                  {draft.body.replace(/<@[0-9a-f-]{36}>/g, "@someone")}
                </p>
              </div>
              <span className="self-center font-mono text-xs text-ink-3 opacity-0 group-hover:opacity-100">
                Continue
              </span>
            </JumpRow>
          ))}
        </section>
      ) : null}
    </ListPage>
  );
}
