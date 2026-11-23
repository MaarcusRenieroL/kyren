import { useState } from "react";
import { CalendarIcon } from "lucide-react";
import { Button } from "@zentro/ui/shadcn/button";
import { Input } from "@zentro/ui/shadcn/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@zentro/ui/shadcn/popover";
import { DueDate } from "~/src/components/due-date";
import { dueFromDateInput, getDateInputValue } from "../task-detail-utils";

type DuePickerProps = {
  value: Date | null;
  done: boolean;
  disabled: boolean;
  onChange: (value: Date | null) => void;
};

/** The due date as it reads ("Tomorrow"), the date beside it, a picker on click. */
export function DuePicker({ value, done, disabled, onChange }: DuePickerProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(getDateInputValue(value));

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setDraft(getDateInputValue(value));
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          disabled={disabled}
          aria-label="Due date"
          className="-ml-1.5 h-8 justify-start gap-2.5 px-1.5 text-sm font-normal hover:bg-hover disabled:opacity-100"
        >
          {value ? (
            <>
              <DueDate value={value} done={done} className="text-sm" />
              <span className="font-mono text-xs text-ink-3">
                {value.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </>
          ) : (
            <span className="flex items-center gap-2 font-mono text-[13px] text-ink-3">
              <CalendarIcon className="size-3.5" aria-hidden="true" />
              No date
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 rounded-2xl p-3">
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            onChange(draft ? dueFromDateInput(draft) : null);
            setOpen(false);
          }}
        >
          <Input
            type="date"
            aria-label="Due date"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            className="font-mono"
          />
          <div className="flex justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!value}
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
            >
              Remove date
            </Button>
            <Button type="submit" size="sm">
              Save
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
