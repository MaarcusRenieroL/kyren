import type { RefObject } from "react";
import { Button } from "@zentro/ui/shadcn/button";
import { Skeleton } from "@zentro/ui/shadcn/skeleton";
import { dayHeading } from "../message-body";
import {
  MessageItem,
  type LocalState,
  type MessageActions,
  type MessageView,
} from "../message-item";
import { EmptyChannel, IntroNote } from "./channel-empty-states";
import { FIVE_MINUTES, type ChannelData } from "./channel-view-types";

export function ChannelMessageList({
  listRef,
  stickToBottom,
  messages,
  loadError,
  isDm,
  data,
  refresh,
  rows,
  hasMore,
  loadOlder,
  firstUnread,
  meId,
  highlight,
  canPost,
  actions,
  lastMine,
  seenBy,
  onSettings,
}: {
  listRef: RefObject<HTMLDivElement | null>;
  stickToBottom: React.MutableRefObject<boolean>;
  messages: MessageView[] | null;
  loadError: boolean;
  isDm: boolean;
  data: ChannelData;
  refresh: (initial?: boolean) => Promise<void>;
  rows: Array<{ message: MessageView; local?: LocalState }>;
  hasMore: boolean;
  loadOlder: () => Promise<void>;
  firstUnread: MessageView | undefined;
  meId: string;
  highlight: string | null;
  canPost: boolean;
  actions: MessageActions;
  lastMine: MessageView | undefined;
  seenBy: string[];
  onSettings: () => void;
}) {
  return (
    <div
      ref={listRef}
      onScroll={(event) => {
        const element = event.currentTarget;
        stickToBottom.current =
          element.scrollHeight - element.scrollTop - element.clientHeight < 80;
      }}
      onKeyDown={(event) => {
        const target = event.target as HTMLElement;

        if (!target.matches("[data-message]")) return;

        if (event.key === "ArrowUp" || event.key === "ArrowDown") {
          const all = [
            ...event.currentTarget.querySelectorAll<HTMLElement>(
              "[data-message]",
            ),
          ];
          const next =
            all[all.indexOf(target) + (event.key === "ArrowDown" ? 1 : -1)];

          if (next) {
            event.preventDefault();
            next.focus();
            next.scrollIntoView({ block: "nearest" });
          }
        } else if (event.key === "Escape") {
          document
            .querySelector<HTMLTextAreaElement>(
              "section[aria-label] textarea[aria-label^='Message']",
            )
            ?.focus();
        }
      }}
      className="min-h-0 flex-1 overflow-y-auto py-2"
    >
      {messages === null ? (
        loadError ? (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <span className="flex size-10 items-center justify-center rounded-full border border-danger text-danger-text">
              !
            </span>
            <p className="text-lg font-semibold">
              We couldn’t load {isDm ? data.title : `#${data.name}`}.
            </p>
            <p className="max-w-sm text-[15px] text-ink-2">
              Your messages are safe on the server. Other channels still work.
              Try again in a moment.
            </p>
            <Button variant="outline" onClick={() => void refresh(true)}>
              Try again
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-5 px-5 py-4" aria-busy="true">
            {[70, 45, 80, 55, 62, 40].map((width, index) => (
              <div key={index} className="flex gap-3">
                <Skeleton className="size-9 rounded-full" />
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-3" style={{ width: `${width}%` }} />
                </div>
              </div>
            ))}
            <p className="font-mono text-xs text-ink-3">
              Loading {isDm ? data.title : `#${data.name}`}…
            </p>
          </div>
        )
      ) : rows.length === 0 ? (
        <EmptyChannel data={data} onSettings={onSettings} />
      ) : (
        <>
          {hasMore ? (
            <div className="flex justify-center py-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void loadOlder()}
              >
                Load earlier messages
              </Button>
            </div>
          ) : (
            <IntroNote data={data} />
          )}
          {rows.map(({ message, local: state }, index) => {
            const previous = rows[index - 1]?.message;
            const sameDay =
              previous &&
              new Date(previous.createdAt).toDateString() ===
                new Date(message.createdAt).toDateString();
            const grouped =
              Boolean(sameDay) &&
              previous!.author?.memberId === message.author?.memberId &&
              !previous!.deleted &&
              new Date(message.createdAt).getTime() -
                new Date(previous!.createdAt).getTime() <
                FIVE_MINUTES &&
              message.attachments.length === 0;

            return (
              <div key={message.id}>
                {!sameDay ? (
                  <div className="flex items-center gap-3 px-5 pt-4 pb-1">
                    <span
                      aria-hidden="true"
                      className="h-px flex-1 bg-hairline"
                    />
                    <span className="font-mono text-[11px] text-ink-3">
                      {dayHeading(message.createdAt)}
                    </span>
                    <span
                      aria-hidden="true"
                      className="h-px flex-1 bg-hairline"
                    />
                  </div>
                ) : null}
                {firstUnread?.id === message.id ? (
                  <div
                    id="unread-divider"
                    role="separator"
                    aria-label="New messages"
                    className="flex items-center gap-3 px-5 py-1"
                  >
                    <span
                      aria-hidden="true"
                      className="h-px flex-1 bg-danger"
                    />
                    <span className="font-mono text-[11px] text-danger-text">
                      New
                    </span>
                  </div>
                ) : null}
                <MessageItem
                  message={message}
                  meId={meId}
                  grouped={grouped && firstUnread?.id !== message.id}
                  highlighted={highlight === message.id}
                  canPost={canPost}
                  canModerate={data.canManage}
                  local={state}
                  actions={actions}
                />
                {lastMine?.id === message.id && seenBy.length && !state ? (
                  <p className="pr-5 text-right font-mono text-[11px] text-ink-3">
                    {isDm && seenBy.length === 1
                      ? "Seen"
                      : `Seen by ${seenBy.slice(0, 3).join(", ")}${seenBy.length > 3 ? ` +${seenBy.length - 3}` : ""}`}
                  </p>
                ) : null}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
