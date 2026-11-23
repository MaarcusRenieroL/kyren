"use client";

import { Button } from "@kyren/ui/shadcn/button";
import { useState } from "react";
import { ActivityIcon, FileTextIcon, MessageSquareIcon } from "lucide-react";
import { cn } from "@kyren/ui/lib/utils";
import { toastSuccess } from "@kyren/ui/index";
import { copyText } from "~/src/lib/clipboard";
import {
  EntityCard,
  ForwardedBlock,
  HuddleCard,
  LinkPreviewCard,
  PollCard,
} from "./message-cards";
import { MessageBody, messageTime, relativeAgo } from "./message-body";
import { Attachments } from "./message-item/message-attachments";
import { Avatar } from "./message-item/message-avatar";
import {
  MessageEditBox,
  MessageLocalStatus,
  MessageTranslationBox,
} from "./message-item/message-content-boxes";
import { MessageHeader } from "./message-item/message-header";
import { MessageItemToolbar } from "./message-item/message-item-toolbar";
import { MessageReactions } from "./message-item/message-reactions";
import { TaskCard } from "./message-item/message-task-card";
import type {
  AttachmentView,
  LocalState,
  MessageActions,
  MessageView,
} from "./message-item/message-item-types";

export type { AttachmentView, LocalState, MessageActions, MessageView };
export { Avatar, FileTextIcon };

export type MessageItemProps = {
  message: MessageView;
  meId: string;
  grouped?: boolean;
  highlighted?: boolean;
  canPost: boolean;
  canModerate?: boolean;
  local?: LocalState;
  inThread?: boolean;
  actions: MessageActions;
};

export function MessageItem({
  message,
  meId,
  grouped = false,
  highlighted = false,
  canPost,
  canModerate = false,
  local,
  inThread = false,
  actions,
}: MessageItemProps) {
  const [editing, setEditing] = useState(false);
  const [toolbarPinned, setToolbarPinned] = useState(false);
  const [draft, setDraft] = useState(message.body);
  const [translation, setTranslation] = useState<{
    language: string;
    text: string | null;
    error?: string;
  } | null>(null);

  const names = message.names;
  const keys = new Set(message.tasks.map((task) => task.key));
  const authorName = message.author?.name ?? "Someone";

  if (message.deleted) {
    return (
      <div className={cn("flex gap-3 px-4 py-1", grouped ? "" : "pt-3")}>
        <span className="w-9 shrink-0" />
        <p className="text-sm text-ink-3 italic">This message was deleted.</p>
      </div>
    );
  }

  if (message.kind === "event") {
    return (
      <article
        id={`message-${message.id}`}
        className="flex items-center gap-3 px-4 py-1 text-[13px] text-ink-2"
      >
        <span className="flex w-9 shrink-0 justify-center">
          <ActivityIcon className="size-3.5 text-ink-3" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="font-medium text-ink">{authorName}</span>{" "}
          <MessageBody
            body={message.body}
            names={names}
            meId={meId}
            taskKeys={keys}
          />
        </span>
        <time
          dateTime={new Date(message.createdAt).toISOString()}
          className="font-mono text-[11px] text-ink-3"
        >
          {messageTime(message.createdAt)}
        </time>
      </article>
    );
  }

  const translate = (language: string) => {
    setTranslation({ language, text: null });
    void Promise.resolve(actions.onTranslate?.(message, language))
      .then((text) => setTranslation({ language, text: text ?? "" }))
      .catch((error: Error) =>
        setTranslation({ language, text: null, error: error.message }),
      );
  };

  const copyLink = () => {
    const url = new URL(window.location.href);
    url.searchParams.set("m", message.id);
    void copyText(url.toString()).then((done) => {
      if (done) toastSuccess("Link copied");
    });
  };

  return (
    <article
      id={`message-${message.id}`}
      data-message={message.id}
      data-highlighted={highlighted || undefined}
      tabIndex={local ? undefined : 0}
      aria-label={`Message from ${authorName}`}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget || editing || local) return;
        if (event.key === "e" && message.mine && actions.onEdit) {
          event.preventDefault();
          setDraft(message.body);
          setEditing(true);
        } else if (
          event.key === "r" &&
          !inThread &&
          canPost &&
          actions.onReply
        ) {
          event.preventDefault();
          actions.onReply(message);
        } else if (event.key === "s" && actions.onSave) {
          event.preventDefault();
          actions.onSave(message, !message.saved);
        } else if (event.key === "u" && actions.onMarkUnread) {
          event.preventDefault();
          actions.onMarkUnread(message);
        } else if ((event.key === "+" || event.key === "=") && canPost) {
          event.preventDefault();
          actions.onReact(message, "👍");
        }
      }}
      className={cn(
        "group relative flex gap-3 px-4 py-1 outline-none hover:bg-hover/60 focus-visible:bg-hover/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        grouped ? "" : "pt-3",
        highlighted && "bg-signal-subtle/60",
        local === "failed" && "bg-danger-subtle/40",
      )}
    >
      <span className="w-9 shrink-0">
        {grouped ? (
          <span className="hidden pt-1 text-right font-mono text-[10px] text-ink-3 group-hover:block">
            {messageTime(message.createdAt)}
          </span>
        ) : (
          <Avatar name={authorName} presence={message.author?.presence} />
        )}
      </span>

      <div className="min-w-0 flex-1">
        {grouped ? null : (
          <MessageHeader message={message} authorName={authorName} />
        )}

        {editing ? (
          <MessageEditBox
            draft={draft}
            setDraft={setDraft}
            setEditing={setEditing}
            message={message}
            onEdit={actions.onEdit}
          />
        ) : message.body &&
          message.kind !== "poll" &&
          message.kind !== "huddle" ? (
          <div className="text-[15px] leading-6">
            <MessageBody
              body={message.body}
              names={names}
              meId={meId}
              taskKeys={keys}
            />
            {message.editedAt ? (
              <span className="ml-1.5 text-[11px] text-ink-3">(edited)</span>
            ) : null}
          </div>
        ) : null}

        {translation ? (
          <MessageTranslationBox
            translation={translation}
            names={names}
            meId={meId}
            onDismiss={() => setTranslation(null)}
          />
        ) : null}

        {message.forwarded ? (
          <ForwardedBlock forwarded={message.forwarded} />
        ) : null}

        {message.poll ? (
          <PollCard
            poll={message.poll}
            canVote={canPost && Boolean(actions.onVote)}
            canClose={
              (message.mine || canModerate) && Boolean(actions.onClosePoll)
            }
            onVote={(idx) => actions.onVote?.(message.poll!.id, idx)}
            onClose={() => actions.onClosePoll?.(message.poll!.id)}
          />
        ) : null}

        {message.kind === "huddle" && typeof message.meta?.url === "string" ? (
          <HuddleCard url={message.meta.url} />
        ) : null}

        {message.attachments.length ? (
          <Attachments
            files={message.attachments}
            onOpen={actions.onOpenFile}
          />
        ) : null}

        {message.tasks.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}

        {message.entities.map((entity, index) => (
          <EntityCard key={`${entity.type}-${index}`} entity={entity} />
        ))}

        {message.links.map((link) => (
          <LinkPreviewCard key={link.url} link={link} />
        ))}

        <MessageReactions
          message={message}
          canPost={canPost}
          actions={actions}
          setToolbarPinned={setToolbarPinned}
        />

        {!inThread && message.replies && message.replies.count > 0 ? (
          <Button
            variant="custom"
            type="button"
            onClick={() => actions.onReply?.(message)}
            className="mt-1.5 flex items-center gap-2 rounded-md px-1.5 py-0.5 text-[13px] text-signal-strong outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-ring"
          >
            <MessageSquareIcon className="size-3.5" aria-hidden="true" />
            <span className="font-medium">
              {message.replies.count}{" "}
              {message.replies.count === 1 ? "reply" : "replies"}
            </span>
            {message.replies.lastAt ? (
              <span className="text-ink-3">
                Last reply {relativeAgo(message.replies.lastAt)}
              </span>
            ) : null}
          </Button>
        ) : null}

        <MessageLocalStatus local={local} message={message} actions={actions} />
      </div>

      {!local && !editing ? (
        <MessageItemToolbar
          message={message}
          canPost={canPost}
          canModerate={canModerate}
          inThread={inThread}
          toolbarPinned={toolbarPinned}
          setToolbarPinned={setToolbarPinned}
          actions={actions}
          onStartEdit={() => {
            setDraft(message.body);
            setEditing(true);
          }}
          onTranslate={translate}
          onCopyLink={copyLink}
        />
      ) : null}
    </article>
  );
}
