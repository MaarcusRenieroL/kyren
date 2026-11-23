"use client";

import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { SearchIcon } from "lucide-react";

import { Kbd } from "@kyren/ui/components/kbd";
import { cn } from "@kyren/ui/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@kyren/ui/shadcn/dialog";

import type { ShellModule } from "./app-sidebar";
import { useRecent } from "./use-recent";
import { useCommandPaletteShortcuts } from "./command-palette/use-command-palette-shortcuts";
import { useCommandPaletteSearch } from "./command-palette/use-command-palette-search";
import { CommandPaletteResults } from "./command-palette/command-palette-results";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modules: ShellModule[];
  actions: Array<{ id: string; label: string; key?: string; run: () => void }>;
};

/** Jump anywhere, create something, or flip the theme, from the keyboard. */
export function CommandPalette({
  open,
  onOpenChange,
  modules,
  actions,
}: Props) {
  const router = useRouter();
  const recent = useRecent();

  const { resolvedTheme, toggleTheme, toggleDensity } =
    useCommandPaletteShortcuts({
      open,
      onOpenChange,
      modules,
      actions,
    });

  const { query, setQuery, trimmed, has, taskHits, docs, searchResults } =
    useCommandPaletteSearch({
      open,
      modules,
    });

  const done = (run: () => void) => {
    onOpenChange(false);
    run();
  };

  const go = (href: string) => done(() => router.push(href));
  const searching = trimmed.length > 0;
  const resultCount = taskHits.length + docs.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="top-[88px] max-w-[40rem] translate-y-0 gap-0 overflow-hidden rounded-[20px] p-0 sm:max-w-[40rem]"
      >
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <DialogDescription className="sr-only">
          Search for a place to go or something to create.
        </DialogDescription>
        <Command label="Command palette" loop>
          <div className="flex h-14 items-center gap-3 border-b border-hairline px-4">
            <SearchIcon className="size-4 text-ink-3" aria-hidden="true" />
            <Command.Input
              autoFocus
              value={query}
              onValueChange={setQuery}
              placeholder="Search tasks, docs, or jump to…"
              className="h-full flex-1 bg-transparent text-base outline-none placeholder:text-ink-3"
            />
            <Kbd>esc</Kbd>
          </div>
          <Command.List className="max-h-[26rem] overflow-y-auto p-2">
            <Command.Empty className="px-3 py-8 text-center text-sm text-ink-2">
              Nothing matches “{trimmed}”.
            </Command.Empty>

            <CommandPaletteResults
              searching={searching}
              trimmed={trimmed}
              taskHits={taskHits}
              docs={docs}
              searchResults={searchResults}
              has={has}
              recentItems={recent.items}
              modules={modules}
              actions={actions}
              resolvedTheme={resolvedTheme}
              go={go}
              done={done}
              toggleTheme={toggleTheme}
              toggleDensity={toggleDensity}
            />
          </Command.List>
          <div
            className={cn(
              "flex items-center gap-3 border-t border-hairline px-4 py-2.5 text-xs text-ink-3",
            )}
          >
            <span className="flex items-center gap-1">
              <Kbd>↑↓</Kbd> move
            </span>
            <span className="flex items-center gap-1">
              <Kbd>↵</Kbd> open
            </span>
            <span className="ml-auto font-mono">
              {searching
                ? `${resultCount} result${resultCount === 1 ? "" : "s"}`
                : ""}
            </span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
