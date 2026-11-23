"use client";

import { Textarea } from "@kyren/ui/shadcn/textarea";
import { cn } from "@kyren/ui/lib/utils";
import { ComposerAttachments } from "./composer/composer-attachments";
import { ComposerAutocomplete } from "./composer/composer-autocomplete";
import { ComposerToolbar } from "./composer/composer-toolbar";
import { useComposer } from "./composer/use-composer";
import type { Draft, Person, SlashCommand } from "./composer/composer-types";

export type { Draft, Person, SlashCommand };

export interface ComposerProps {
  placeholder: string;
  people: Person[];
  canAttach?: boolean;
  disabled?: boolean;
  disabledNote?: string;
  offline?: boolean;
  onSend: (draft: Draft) => Promise<void> | void;
  autoFocus?: boolean;
  compact?: boolean;
  onTyped?: () => void;
  commands?: SlashCommand[];
  /** Saves what is typed here, per conversation or thread. */
  draftScope?: { channelId: string; key: string };
  onSchedule?: (draft: Draft, at: Date) => Promise<void> | void;
  onManageEmoji?: () => void;
}

/** The message box: formatting, @mentions, #links, emoji, commands, files. */
export function Composer({
  placeholder,
  people,
  canAttach = true,
  disabled = false,
  disabledNote,
  offline = false,
  onSend,
  autoFocus = false,
  compact = false,
  onTyped,
  commands = [],
  draftScope,
  onSchedule,
  onManageEmoji,
}: ComposerProps) {
  const {
    text,
    setText,
    pending,
    trigger,
    setTrigger,
    options,
    index,
    setIndex,
    dragging,
    setDragging,
    later,
    setLater,
    slashQuery,
    empty,
    reading,
    areaRef,
    customList,
    addFiles,
    removeFile,
    insert,
    pick,
    send,
    sendLater,
    onKeyDown,
    onPaste,
    onDrop,
    detectTrigger,
  } = useComposer({
    people,
    commands,
    draftScope,
    disabled,
    canAttach,
    autoFocus,
    compact,
    onSend,
    onSchedule,
    onTyped,
  });

  if (disabled && disabledNote) {
    return (
      <div className="rounded-lg border border-dashed border-line-strong px-4 py-3 text-center text-sm text-ink-2">
        {disabledNote}
      </div>
    );
  }

  return (
    <div
      onDragOver={(event) => {
        if (canAttach) {
          event.preventDefault();
          setDragging(true);
        }
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={cn(
        "relative rounded-xl border bg-surface transition-colors focus-within:border-signal focus-within:ring-4 focus-within:ring-ring/20",
        dragging ? "border-signal bg-signal-subtle" : "border-hairline",
      )}
    >
      <ComposerAutocomplete
        options={options}
        index={index}
        trigger={trigger}
        slashQuery={slashQuery}
        onSelect={pick}
        onHover={setIndex}
      />

      <ComposerAttachments pending={pending} onRemove={removeFile} />

      <Textarea
        ref={areaRef}
        value={text}
        rows={1}
        placeholder={
          offline ? `${placeholder} · sends when you reconnect` : placeholder
        }
        aria-label={placeholder}
        onChange={(event) => {
          setText(event.target.value);
          detectTrigger(event.target.value, event.target.selectionStart);
          onTyped?.();
        }}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onBlur={() => setTimeout(() => setTrigger(null), 120)}
        className="block max-h-56 w-full resize-none bg-transparent px-4 pt-3.5 pb-1 text-[15px] leading-6 outline-none placeholder:text-ink-3"
      />

      <ComposerToolbar
        canAttach={canAttach}
        compact={compact}
        empty={empty}
        reading={reading}
        text={text}
        later={later}
        setLater={setLater}
        customList={customList}
        onManageEmoji={onManageEmoji}
        onAttachFiles={addFiles}
        onInsert={insert}
        onSend={() => void send()}
        onSendLater={onSchedule ? (at) => void sendLater(at) : undefined}
        areaRef={areaRef}
      />
    </div>
  );
}
