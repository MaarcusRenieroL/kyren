"use client";

import { useState } from "react";
import { CalendarIcon } from "lucide-react";
import { Button } from "@kyren/ui/shadcn/button";
import { Calendar } from "@kyren/ui/shadcn/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@kyren/ui/shadcn/popover";
import { dateFormat } from "./types";

export function FileDateFilter({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = value ? new Date(`${value}T00:00:00`) : undefined;
  const display = selected ? dateFormat.format(selected) : "Pick a date";

  return (
    <div className="grid min-w-0 gap-1 text-sm">
      <span>{label}</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            aria-label={`${label}, ${display}`}
            className="justify-start px-2"
          >
            <CalendarIcon aria-hidden />
            <span className="truncate">{display}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected}
            autoFocus
            onSelect={(date) => {
              onChange(
                date
                  ? [date.getFullYear(), date.getMonth() + 1, date.getDate()]
                      .map((part, index) =>
                        String(part).padStart(index === 0 ? 4 : 2, "0"),
                      )
                      .join("-")
                  : "",
              );
              setOpen(false);
            }}
          />
          {selected ? (
            <div className="border-t px-3 py-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
              >
                Clear date
              </Button>
            </div>
          ) : null}
        </PopoverContent>
      </Popover>
    </div>
  );
}
