"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BellRingIcon,
  BookmarkIcon,
  CheckIcon,
  Trash2Icon,
} from "lucide-react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@zentro/api/server";
import { useTrpcClient } from "@zentro/api/react";
import { cn } from "@zentro/ui/lib/utils";
import { toastError } from "@zentro/ui/index";
import { Button } from "@zentro/ui/shadcn/button";
import { useChatSidebar } from "../chat-store";
import { MessageBody, relativeAgo, untilLabel } from "../message-body";
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
type SavedItem = Outputs["savedList"][number];

/** Messages saved for later, with reminders. */
export function SavedView() {
  const trpc = useTrpcClient();
  const sidebar = useChatSidebar();
  const [items, setItems] = useState<SavedItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState<"open" | "reminders" | "done">("open");

  const load = useCallback(async () => {
    try {
      setItems(await trpc.chat.savedList.query());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [trpc]);

  useEffect(() => {
    void load();
  }, [load]);

  const change = async (action: () => Promise<unknown>, fail: string) => {
    try {
      await action();
      await Promise.all([load(), sidebar.refresh()]);
    } catch (error) {
      toastError(error, fail);
    }
  };

  const open = items?.filter((item) => !item.completedAt) ?? [];
  const reminders = open.filter((item) => item.remindAt);
  const done = items?.filter((item) => item.completedAt) ?? [];
  const shown = tab === "open" ? open : tab === "reminders" ? reminders : done;

  return (
    <ListPage
      icon={<BookmarkIcon className="size-4" aria-hidden="true" />}
      title="Saved"
      count={items ? `${open.length} open` : undefined}
    >
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          ["open", "Saved", open.length],
          ["reminders", "Reminders", reminders.length],
          ["done", "Done", done.length],
        ]}
      />

      {items === null && !failed ? <ListSkeleton /> : null}
      {failed && !items ? (
        <p className="pt-8 text-center text-[15px] text-ink-2">
          Couldn’t load your saved messages.{" "}
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
          title={tab === "done" ? "Nothing finished yet." : "Nothing saved."}
          hint="Save a message from its ⋯ menu, or ask to be reminded about it. It’ll wait here."
        />
      ) : null}

      <div className="flex flex-col pt-3">
        {shown.map((item) => (
          <JumpRow
            key={item.message.id}
            href={`${where(item.channelName, item.message.channelId)}?m=${item.message.id}`}
            label={`Open message from ${item.message.author?.name ?? "someone"}`}
          >
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
                </span>{" "}
                <span className="font-mono text-[11px] text-ink-3">
                  {relativeAgo(item.message.createdAt)}
                </span>
              </p>
              <div className={cn("line-clamp-3 text-[15px] leading-6", above)}>
                <MessageBody
                  body={item.message.body || "Attachment"}
                  names={item.message.names}
                />
              </div>
              {item.remindAt && !item.completedAt ? (
                <p
                  className={cn(
                    "mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[11px]",
                    item.due
                      ? "border-danger text-danger-text"
                      : "border-hairline text-ink-2",
                  )}
                >
                  <BellRingIcon className="size-3" aria-hidden="true" />
                  {item.due
                    ? "Reminder due"
                    : `Reminder ${untilLabel(item.remindAt)}`}
                </p>
              ) : null}
            </div>
            <div className="relative flex shrink-0 items-start gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={item.completedAt ? "Mark not done" : "Mark done"}
                title={item.completedAt ? "Mark not done" : "Mark done"}
                onClick={() =>
                  void change(
                    () =>
                      trpc.chat.completeSaved.mutate({
                        messageId: item.message.id,
                        done: !item.completedAt,
                      }),
                    "Could not update that",
                  )
                }
              >
                <CheckIcon className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Remove from saved"
                title="Remove from saved"
                onClick={() =>
                  void change(
                    () =>
                      trpc.chat.saveMessage.mutate({
                        messageId: item.message.id,
                        saved: false,
                      }),
                    "Could not remove it",
                  )
                }
              >
                <Trash2Icon className="size-4" />
              </Button>
            </div>
          </JumpRow>
        ))}
      </div>
    </ListPage>
  );
}
