"use client";

import { Input } from "@kyren/ui/shadcn/input";
import { useRef, type RefObject } from "react";
import {
  ArrowUpIcon,
  AtSignIcon,
  BoldIcon,
  CodeIcon,
  HashIcon,
  ImageIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  PaperclipIcon,
} from "lucide-react";
import { cn } from "@kyren/ui/lib/utils";
import { Button } from "@kyren/ui/shadcn/button";
import { ComposerEmojiPopover } from "./composer-emoji-popover";
import { ComposerSchedulePopover } from "./composer-schedule-popover";

type CustomEmojiItem = { name: string; url: string };

type ComposerToolbarProps = {
  canAttach?: boolean;
  compact?: boolean;
  empty: boolean;
  reading: boolean;
  text: string;
  later: boolean;
  setLater: (open: boolean) => void;
  customList: CustomEmojiItem[];
  onManageEmoji?: () => void;
  onAttachFiles: (files: FileList | File[]) => void;
  onInsert: (before: string, after?: string, fallback?: string) => void;
  onSend: () => void;
  onSendLater?: (at: Date) => void;
  areaRef: RefObject<HTMLTextAreaElement | null>;
};

const tool =
  "size-8 rounded-sm text-ink-2 hover:bg-hover hover:text-ink focus-visible:ring-2 focus-visible:ring-ring";

export function ComposerToolbar({
  canAttach = true,
  compact = false,
  empty,
  reading,
  text,
  later,
  setLater,
  customList,
  onManageEmoji,
  onAttachFiles,
  onInsert,
  onSend,
  onSendLater,
}: ComposerToolbarProps) {
  const fileInput = useRef<HTMLInputElement>(null);

  return (
    <div className="flex items-center gap-0.5 px-2 pb-2">
      {canAttach ? (
        <>
          <Input
            appearance="native"
            ref={fileInput}
            type="file"
            multiple
            className="sr-only"
            aria-label="Attach files"
            onChange={(event) => {
              if (event.target.files) onAttachFiles(event.target.files);
              event.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className={tool}
            aria-label="Attach a file"
            onClick={() => fileInput.current?.click()}
          >
            <PaperclipIcon className="size-4" />
          </Button>
        </>
      ) : null}

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className={tool}
        aria-label="Mention someone"
        onClick={() => onInsert("@")}
      >
        <AtSignIcon className="size-4" />
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className={tool}
        aria-label="Link a task, doc or project"
        onClick={() => onInsert("#")}
      >
        <HashIcon className="size-4" />
      </Button>

      <span
        aria-hidden="true"
        className="mx-1 hidden h-4 w-px bg-hairline sm:block"
      />

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className={cn(tool, "hidden sm:inline-flex")}
        aria-label="Bold"
        onClick={() => onInsert("**", "**", "bold")}
      >
        <BoldIcon className="size-4" />
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className={cn(tool, "hidden sm:inline-flex")}
        aria-label="Italic"
        onClick={() => onInsert("_", "_", "italic")}
      >
        <ItalicIcon className="size-4" />
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className={cn(tool, "hidden sm:inline-flex")}
        aria-label="Code"
        onClick={() =>
          text.includes("\n")
            ? onInsert("```\n", "\n```", "code")
            : onInsert("`", "`", "code")
        }
      >
        <CodeIcon className="size-4" />
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className={cn(tool, "hidden sm:inline-flex")}
        aria-label="List"
        onClick={() => onInsert("\n- ", "", "item")}
      >
        <ListIcon className="size-4" />
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className={cn(tool, "hidden sm:inline-flex")}
        aria-label="Link"
        onClick={() => onInsert("", " https://")}
      >
        <LinkIcon className="size-4" />
      </Button>

      <span aria-hidden="true" className="mx-1 h-4 w-px bg-hairline" />

      <ComposerEmojiPopover
        customList={customList}
        onManageEmoji={onManageEmoji}
        onInsert={onInsert}
        toolClass={tool}
      />

      <span className="flex-1" />
      {compact ? null : (
        <span className="mr-2 hidden font-mono text-[11px] whitespace-nowrap text-ink-3 sm:block">
          ↵ send · ⇧↵ new line
        </span>
      )}

      <div className="flex items-center">
        <Button
          type="button"
          size="icon-sm"
          aria-label="Send message"
          disabled={empty || reading}
          onClick={onSend}
          className={cn(
            "size-8",
            onSendLater ? "rounded-r-none" : "rounded-md",
          )}
        >
          {reading ? (
            <ImageIcon className="size-4 animate-pulse" />
          ) : (
            <ArrowUpIcon className="size-4" />
          )}
        </Button>
        {onSendLater ? (
          <ComposerSchedulePopover
            later={later}
            setLater={setLater}
            disabled={empty || reading}
            onSendLater={onSendLater}
          />
        ) : null}
      </div>
    </div>
  );
}
