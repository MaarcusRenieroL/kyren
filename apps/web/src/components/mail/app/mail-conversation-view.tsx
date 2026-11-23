"use client";

import {
  ArchiveRestoreIcon,
  ArrowLeftIcon,
  ForwardIcon,
  MailOpenIcon,
  PaperclipIcon,
  ReplyAllIcon,
  ReplyIcon,
  StarIcon,
  Trash2Icon,
} from "lucide-react";
import { Button } from "@zentro/ui/shadcn/button";

import { fileSize } from "~/src/components/chat/message-body";
import { apiPath } from "~/src/lib/paths";
import { stamp, type Conversation, type Folder, type Row } from "./mail-types";

export function MailConversationView({
  openId,
  conversation,
  current,
  folder,
  onClose,
  onFlag,
  onPurge,
  onReply,
  onForward,
}: {
  openId: string | null;
  conversation: Conversation | null;
  current?: Row;
  folder: Folder;
  onClose: () => void;
  onFlag: (ids: string[], change: { read?: boolean; starred?: boolean; trashed?: boolean }) => void;
  onPurge: (ids: string[]) => void;
  onReply: (all: boolean) => void;
  onForward: () => void;
}) {
  return (
    <article
      aria-label="Message"
      className={`min-w-0 flex-1 flex-col overflow-y-auto ${openId ? "flex" : "hidden md:flex"}`}
    >
      {!openId || !conversation ? (
        <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-ink-3">
          {openId ? "Opening…" : "Select a message to read it."}
        </div>
      ) : (
        <>
          <header className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
            <Button
              variant="ghost"
              size="icon-sm"
              className="md:hidden"
              aria-label="Back to messages"
              onClick={onClose}
            >
              <ArrowLeftIcon aria-hidden />
            </Button>
            <h2 className="min-w-0 flex-1 truncate text-lg font-semibold">
              {conversation.subject}
            </h2>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={current?.starred ? "Remove star" : "Star"}
              aria-pressed={current?.starred ?? false}
              onClick={() => onFlag([openId], { starred: !current?.starred })}
            >
              <StarIcon
                className={current?.starred ? "fill-warning text-warning" : ""}
                aria-hidden
              />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Mark as unread"
              onClick={() => onFlag([openId], { read: false })}
            >
              <MailOpenIcon aria-hidden />
            </Button>
            {folder === "trash" ? (
              <>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Restore"
                  onClick={() => onFlag([openId], { trashed: false })}
                >
                  <ArchiveRestoreIcon aria-hidden />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onPurge([openId])}>
                  Delete forever
                </Button>
              </>
            ) : (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Move to trash"
                onClick={() => onFlag([openId], { trashed: true })}
              >
                <Trash2Icon aria-hidden />
              </Button>
            )}
          </header>

          <div className="flex flex-col gap-4 p-4">
            {conversation.messages.map((message) => (
              <section
                key={message.id}
                className="rounded-xl border border-line p-4"
              >
                <div className="mb-3 flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium">
                    {message.mine ? "Me" : message.from.name}
                  </span>
                  <span className="text-xs text-ink-3">
                    {message.from.email}
                  </span>
                  <span className="ml-auto text-xs text-ink-3">
                    {stamp.format(new Date(message.at))}
                  </span>
                </div>
                <p className="mb-3 text-xs text-ink-3">
                  To {message.to.map((p) => p.name).join(", ")}
                  {message.cc.length
                    ? ` · Cc ${message.cc.map((p) => p.name).join(", ")}`
                    : ""}
                </p>
                <div className="text-sm leading-relaxed whitespace-pre-wrap">
                  {message.body}
                </div>
                {message.attachments.length ? (
                  <ul
                    aria-label="Attachments"
                    className="mt-3 flex flex-wrap gap-2"
                  >
                    {message.attachments.map((file) => (
                      <li key={file.id}>
                        <a
                          href={apiPath(file.url)}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 rounded-md border border-line px-2 py-1 text-xs hover:bg-sunken"
                        >
                          <PaperclipIcon className="size-3" aria-hidden />
                          <span className="max-w-56 truncate">{file.name}</span>
                          <span className="text-ink-3">
                            {fileSize(file.size)}
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => onReply(false)}>
                <ReplyIcon aria-hidden />
                Reply
              </Button>
              <Button variant="outline" onClick={() => onReply(true)}>
                <ReplyAllIcon aria-hidden />
                Reply all
              </Button>
              <Button variant="outline" onClick={onForward}>
                <ForwardIcon aria-hidden />
                Forward
              </Button>
            </div>
          </div>
        </>
      )}
    </article>
  );
}
