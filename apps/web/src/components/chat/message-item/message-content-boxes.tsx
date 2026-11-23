"use client";

import { Textarea } from "@kyren/ui/shadcn/textarea";
import { Button } from "@kyren/ui/shadcn/button";
import { AlertCircleIcon, LanguagesIcon, XIcon } from "lucide-react";
import { MessageBody } from "../message-body";
import type {
  LocalState,
  MessageActions,
  MessageView,
} from "./message-item-types";

type MessageEditBoxProps = {
  draft: string;
  setDraft: (v: string) => void;
  setEditing: (v: boolean) => void;
  message: MessageView;
  onEdit?: MessageActions["onEdit"];
};

export function MessageEditBox({
  draft,
  setDraft,
  setEditing,
  message,
  onEdit,
}: MessageEditBoxProps) {
  return (
    <div className="mt-1 flex flex-col gap-2">
      <Textarea
        value={draft}
        autoFocus
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setEditing(false);
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            void Promise.resolve(onEdit?.(message, draft)).then(() =>
              setEditing(false),
            );
          }
        }}
        rows={2}
        aria-label="Edit message"
        className="w-full resize-none rounded-lg border border-signal bg-surface px-3 py-2 text-[15px] leading-6 outline-none"
      />
      <div className="flex gap-2 text-xs text-ink-3">
        <span>Esc to cancel · ↵ to save</span>
      </div>
    </div>
  );
}

type MessageTranslationBoxProps = {
  translation: { language: string; text: string | null; error?: string };
  names: Record<string, string>;
  meId: string;
  onDismiss: () => void;
};

export function MessageTranslationBox({
  translation,
  names,
  meId,
  onDismiss,
}: MessageTranslationBoxProps) {
  return (
    <div className="mt-1.5 flex max-w-xl items-start gap-2 rounded-lg border border-hairline bg-sunken/60 px-3 py-2 text-[14px]">
      <LanguagesIcon
        className="mt-0.5 size-3.5 shrink-0 text-ink-3"
        aria-hidden="true"
      />
      <span className="min-w-0 flex-1">
        <span className="block font-mono text-[11px] text-ink-3">
          Translated to {translation.language}
        </span>
        {translation.error ? (
          <span className="text-danger-text">{translation.error}</span>
        ) : translation.text === null ? (
          <span className="text-ink-3">Translating…</span>
        ) : (
          <MessageBody body={translation.text} names={names} meId={meId} />
        )}
      </span>
      <Button
        variant="custom"
        type="button"
        aria-label="Dismiss translation"
        onClick={onDismiss}
        className="rounded-xs text-ink-3 hover:text-ink"
      >
        <XIcon className="size-3.5" />
      </Button>
    </div>
  );
}

type MessageLocalStatusProps = {
  local?: LocalState;
  message: MessageView;
  actions: MessageActions;
};

export function MessageLocalStatus({
  local,
  message,
  actions,
}: MessageLocalStatusProps) {
  if (local === "failed") {
    return (
      <p className="mt-1 flex items-center gap-1.5 text-xs text-danger-text">
        <AlertCircleIcon className="size-3.5" aria-hidden="true" />
        Not sent.
        <Button
          variant="custom"
          type="button"
          onClick={() => actions.onRetry?.(message)}
          className="underline underline-offset-2"
        >
          Retry
        </Button>
        ·
        <Button
          variant="custom"
          type="button"
          onClick={() => actions.onDiscard?.(message)}
          className="underline underline-offset-2"
        >
          Delete
        </Button>
      </p>
    );
  }
  if (local === "queued") {
    return (
      <p className="mt-1 text-xs text-ink-3">
        Queued · sends when you’re back online
      </p>
    );
  }
  if (local === "sending") {
    return <p className="mt-1 text-xs text-ink-3">Sending…</p>;
  }
  return null;
}
