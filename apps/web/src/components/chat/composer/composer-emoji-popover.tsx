"use client";

import { SmileIcon } from "lucide-react";
import { Button } from "@kyren/ui/shadcn/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@kyren/ui/shadcn/popover";
import { composerEmoji } from "./composer-types";

type ComposerEmojiPopoverProps = {
  customList: Array<{ name: string; url: string }>;
  onManageEmoji?: () => void;
  onInsert: (emoji: string) => void;
  toolClass: string;
};

export function ComposerEmojiPopover({
  customList,
  onManageEmoji,
  onInsert,
  toolClass,
}: ComposerEmojiPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className={toolClass}
          aria-label="Add an emoji"
        >
          <SmileIcon className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="flex w-60 flex-col gap-2 p-2">
        <div className="grid grid-cols-6 gap-1">
          {composerEmoji.map((item) => (
            <Button
              variant="custom"
              key={item}
              type="button"
              onClick={() => onInsert(item)}
              className="rounded-sm p-1 text-lg hover:bg-hover"
            >
              {item}
            </Button>
          ))}
        </div>
        {customList.length ? (
          <div className="grid grid-cols-6 gap-1 border-t border-hairline pt-2">
            {customList.map((item) => (
              <Button
                variant="custom"
                key={item.name}
                type="button"
                title={`:${item.name}:`}
                onClick={() => onInsert(`:${item.name}: `)}
                className="flex items-center justify-center rounded-sm p-1 hover:bg-hover"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.url} alt={item.name} className="size-5" />
              </Button>
            ))}
          </div>
        ) : null}
        {onManageEmoji ? (
          <Button
            variant="custom"
            type="button"
            onClick={onManageEmoji}
            className="rounded-sm px-1 py-1 text-left text-xs text-signal-strong hover:bg-hover"
          >
            Add or remove custom emoji…
          </Button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
