"use client";

import { Label } from "@kyren/ui/shadcn/label";
import { Input } from "@kyren/ui/shadcn/input";
import { ClockIcon, ChevronDownIcon } from "lucide-react";
import { Button } from "@kyren/ui/shadcn/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@kyren/ui/shadcn/popover";
import { laterChoices, localInput } from "./composer-types";

type ComposerSchedulePopoverProps = {
  later: boolean;
  setLater: (open: boolean) => void;
  disabled: boolean;
  onSendLater: (at: Date) => void;
};

export function ComposerSchedulePopover({
  later,
  setLater,
  disabled,
  onSendLater,
}: ComposerSchedulePopoverProps) {
  return (
    <Popover open={later} onOpenChange={setLater}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="icon-sm"
          aria-label="Send later"
          disabled={disabled}
          className="h-8 w-6 rounded-l-none border-l border-on-signal/30"
        >
          <ChevronDownIcon className="size-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 gap-1 p-2">
        <p className="flex items-center gap-1.5 px-2 pt-1 pb-1 text-sm font-semibold">
          <ClockIcon className="size-4" aria-hidden="true" />
          Send later
        </p>
        {laterChoices.map(([label, at]) => (
          <Button
            variant="custom"
            key={label}
            type="button"
            onClick={() => onSendLater(at())}
            className="rounded-md px-2 py-1.5 text-left text-sm hover:bg-hover"
          >
            {label}
          </Button>
        ))}
        <form
          className="flex flex-col gap-1.5 border-t border-hairline px-2 pt-2"
          onSubmit={(event) => {
            event.preventDefault();
            const value = new FormData(event.currentTarget).get("at");
            if (typeof value === "string" && value) {
              onSendLater(new Date(value));
            }
          }}
        >
          <Label className="text-xs text-ink-2" htmlFor="send-at">
            Pick a time
          </Label>
          <Input
            id="send-at"
            name="at"
            type="datetime-local"
            min={localInput(new Date(Date.now() + 60_000))}
            required
            className="h-8 rounded-md border border-hairline bg-surface px-2 text-sm"
          />
          <Button type="submit" size="sm">
            Schedule
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}
