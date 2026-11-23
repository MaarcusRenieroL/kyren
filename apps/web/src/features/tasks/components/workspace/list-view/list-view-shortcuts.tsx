"use client";

import { Button } from "@kyren/ui/shadcn/button";
import type { FC } from "react";
import { KeyboardIcon } from "lucide-react";
import { Kbd } from "@kyren/ui/components/kbd";

type ListViewShortcutsProps = {
  onOpenShortcuts: () => void;
};

export const ListViewShortcuts: FC<ListViewShortcutsProps> = ({
  onOpenShortcuts,
}) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 pt-3 pb-1 px-2 text-xs text-ink-3 border-t border-hairline/60">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 font-mono text-[11px]">
          <Kbd className="text-[10px]">J</Kbd>
          <Kbd className="text-[10px]">K</Kbd> navigate
        </span>
        <span aria-hidden="true" className="hidden text-ink-3 sm:inline">
          •
        </span>
        <span className="inline-flex items-center gap-1 font-mono text-[11px]">
          <Kbd className="text-[10px]">X</Kbd> select
        </span>
        <span aria-hidden="true" className="hidden text-ink-3 sm:inline">
          •
        </span>
        <span className="inline-flex items-center gap-1 font-mono text-[11px]">
          <Kbd className="text-[10px]">S</Kbd> status
        </span>
        <span aria-hidden="true" className="hidden text-ink-3 sm:inline">
          •
        </span>
        <span className="inline-flex items-center gap-1 font-mono text-[11px]">
          <Kbd className="text-[10px]">P</Kbd> priority
        </span>
        <span aria-hidden="true" className="hidden text-ink-3 sm:inline">
          •
        </span>
        <span className="inline-flex items-center gap-1 font-mono text-[11px]">
          <Kbd className="text-[10px]">E</Kbd> points
        </span>
        <span aria-hidden="true" className="hidden text-ink-3 sm:inline">
          •
        </span>
        <span className="inline-flex items-center gap-1 font-mono text-[11px]">
          <Kbd className="text-[10px]">C</Kbd> new
        </span>
      </div>
      <Button
        variant="custom"
        type="button"
        onClick={onOpenShortcuts}
        className="inline-flex items-center gap-1.5 text-xs text-ink-3 hover:text-ink cursor-pointer transition-colors"
      >
        <KeyboardIcon className="size-3.5" />
        <span>Shortcuts</span>
        <Kbd className="text-[10px]">?</Kbd>
      </Button>
    </div>
  );
};
