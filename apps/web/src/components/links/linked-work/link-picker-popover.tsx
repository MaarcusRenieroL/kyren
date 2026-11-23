"use client";

import { Label } from "@zentro/ui/shadcn/label";
import { Input } from "@zentro/ui/shadcn/input";
import { PlusIcon, SearchIcon } from "lucide-react";
import { cn } from "@zentro/ui/lib/utils";
import { Button } from "@zentro/ui/shadcn/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@zentro/ui/shadcn/popover";
import { Skeleton } from "@zentro/ui/shadcn/skeleton";
import type { Candidate, Source } from "./types";
import { kinds } from "./types";
import { Glyph } from "./glyph";

export function LinkPickerPopover({
  open,
  setOpen,
  source,
  kind,
  setKind,
  query,
  setQuery,
  candidates,
  shown,
  onAdd,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  source: Source;
  kind: "relates" | "blocks" | "blocked_by";
  setKind: (kind: "relates" | "blocks" | "blocked_by") => void;
  query: string;
  setQuery: (query: string) => void;
  candidates: Candidate[] | null;
  shown: Candidate[];
  onAdd: (candidate: Candidate) => void;
}) {
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="-mr-2 h-7 px-2">
          <PlusIcon />
          Add link
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 gap-2 p-2">
        {source.type === "task" ? (
          <div
            role="radiogroup"
            aria-label="Link type"
            className="flex gap-1 rounded-md bg-sunken p-1"
          >
            {kinds.map((option) => (
              <Button
                variant="custom"
                key={option.value}
                type="button"
                role="radio"
                aria-checked={kind === option.value}
                onClick={() => setKind(option.value)}
                className={cn(
                  "flex-1 rounded-sm px-2 py-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  kind === option.value
                    ? "bg-surface font-medium text-ink shadow-sm"
                    : "text-ink-2 hover:text-ink",
                )}
              >
                {option.label}
              </Button>
            ))}
          </div>
        ) : null}
        <Label className="relative">
          <span className="sr-only">Find a task or doc</span>
          <SearchIcon
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-ink-3"
          />
          <Input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={
              kind === "relates" ? "Find a task or doc" : "Find a task"
            }
            className="h-8 w-full rounded-md border border-hairline bg-surface pr-2 pl-8 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </Label>
        <ul className="flex max-h-64 flex-col overflow-y-auto">
          {candidates === null ? (
            <li className="px-2 py-3">
              <Skeleton className="h-4 w-2/3" />
            </li>
          ) : shown.length ? (
            shown.map((candidate) => (
              <li key={`${candidate.type}:${candidate.ref}`}>
                <Button
                  variant="custom"
                  type="button"
                  onClick={() => void onAdd(candidate)}
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none hover:bg-hover focus-visible:bg-hover"
                >
                  <Glyph item={candidate} />
                  {candidate.key ? (
                    <span className="font-mono text-xs text-ink-3">
                      {candidate.key}
                    </span>
                  ) : null}
                  <span className="truncate">{candidate.title}</span>
                </Button>
              </li>
            ))
          ) : (
            <li className="px-2 py-3 text-[13px] text-ink-3">
              Nothing matches.
            </li>
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
