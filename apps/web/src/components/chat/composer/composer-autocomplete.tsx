"use client";

import { Button } from "@zentro/ui/shadcn/button";
import {
  AtSignIcon,
  CheckSquareIcon,
  FileTextIcon,
  FolderKanbanIcon,
  SlashIcon,
} from "lucide-react";
import { cn } from "@zentro/ui/lib/utils";
import { ActorAvatar } from "~/src/components/actor-avatar";
import type { Option, Trigger } from "./composer-types";

type ComposerAutocompleteProps = {
  options: Option[];
  index: number;
  trigger: Trigger | null;
  slashQuery?: string;
  onSelect: (option: Option) => void;
  onHover: (index: number) => void;
};

export function ComposerAutocomplete({
  options,
  index,
  trigger,
  slashQuery,
  onSelect,
  onHover,
}: ComposerAutocompleteProps) {
  const showPopup = options.length > 0 && (trigger || slashQuery !== undefined);
  if (!showPopup) return null;

  const heading =
    slashQuery !== undefined
      ? "Commands"
      : trigger?.kind === "link"
        ? "Link a task, doc or project"
        : trigger?.kind === "emoji"
          ? "Emoji"
          : "People";

  return (
    <div
      role="listbox"
      aria-label={heading}
      className="absolute bottom-full left-0 z-20 mb-2 w-80 max-w-full rounded-lg border border-hairline bg-popover p-1.5 shadow-lg"
    >
      <p className="eyebrow px-2 pt-1 pb-1.5">{heading}</p>
      {options.map((option, optionIndex) => {
        const selected = optionIndex === index;
        const key =
          option.kind === "person"
            ? option.person.memberId
            : option.kind === "group"
              ? `g-${option.id}`
              : option.kind === "link"
                ? `l-${option.result.kind}-${option.result.insert}`
                : option.kind === "emoji"
                  ? `e-${option.name}`
                  : `c-${option.command.name}`;

        return (
          <Button
            variant="custom"
            key={key}
            type="button"
            role="option"
            aria-selected={selected}
            onMouseDown={(event) => {
              event.preventDefault();
              onSelect(option);
            }}
            onMouseEnter={() => onHover(optionIndex)}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm",
              selected && "bg-hover",
            )}
          >
            {option.kind === "person" ? (
              <>
                <ActorAvatar name={option.person.name} size={22} />
                <span className="flex-1 truncate">{option.person.name}</span>
                <span className="truncate font-mono text-[11px] text-ink-3">
                  {option.person.email.split("@")[0]}
                </span>
              </>
            ) : option.kind === "group" ? (
              <>
                <AtSignIcon className="size-4 text-ink-3" aria-hidden="true" />
                <span className="font-mono">@{option.id}</span>
                <span className="flex-1 truncate text-right text-xs text-ink-3">
                  {option.note}
                </span>
              </>
            ) : option.kind === "link" ? (
              <>
                {option.result.kind === "task" ? (
                  <CheckSquareIcon
                    className="size-4 text-ink-3"
                    aria-hidden="true"
                  />
                ) : option.result.kind === "doc" ? (
                  <FileTextIcon
                    className="size-4 text-ink-3"
                    aria-hidden="true"
                  />
                ) : (
                  <FolderKanbanIcon
                    className="size-4 text-ink-3"
                    aria-hidden="true"
                  />
                )}
                <span className="flex-1 truncate">{option.result.label}</span>
                <span className="font-mono text-[11px] text-ink-3">
                  {option.result.hint}
                </span>
              </>
            ) : option.kind === "emoji" ? (
              <>
                {option.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={option.url} alt="" className="size-5" />
                ) : (
                  <span className="w-5 text-center text-base">
                    {option.glyph}
                  </span>
                )}
                <span className="font-mono text-[13px]">:{option.name}:</span>
              </>
            ) : (
              <>
                <SlashIcon className="size-4 text-ink-3" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block font-mono text-[13px]">
                    /{option.command.name}{" "}
                    <span className="text-ink-3">{option.command.usage}</span>
                  </span>
                  <span className="block truncate text-xs text-ink-3">
                    {option.command.description}
                  </span>
                </span>
              </>
            )}
          </Button>
        );
      })}
      <p className="px-2 pt-1.5 pb-0.5 font-mono text-[10px] text-ink-3">
        ↑↓ move · ↵ insert · Esc close
      </p>
    </div>
  );
}
