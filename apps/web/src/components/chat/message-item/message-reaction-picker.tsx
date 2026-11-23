"use client";

import { Button } from "@kyren/ui/shadcn/button";
import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@kyren/ui/shadcn/popover";
import { quickReactions } from "./message-item-types";

type ReactionPickerProps = {
  onPick: (emoji: string) => void;
  onOpenChange?: (open: boolean) => void;
  trigger: React.ReactNode;
};

export function ReactionPicker({
  onPick,
  onOpenChange,
  trigger,
}: ReactionPickerProps) {
  const [open, setOpen] = useState(false);
  const changeOpen = (next: boolean) => {
    setOpen(next);
    onOpenChange?.(next);
  };

  return (
    <Popover open={open} onOpenChange={changeOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="end" className="flex w-auto gap-1 p-1.5">
        {[...quickReactions, "😄", "🤔", "🚀", "❤️"].map((value) => (
          <Button
            variant="custom"
            key={value}
            type="button"
            onClick={() => {
              onPick(value);
              changeOpen(false);
            }}
            className="rounded-sm p-1 text-lg hover:bg-hover"
          >
            {value}
          </Button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
