"use client";

import type { ReactNode } from "react";
import { Command } from "cmdk";
import {
  FileTextIcon,
  FolderKanbanIcon,
  HashIcon,
  MoonIcon,
  PlusIcon,
  SearchIcon,
  SunIcon,
} from "lucide-react";

import { StatusGlyph } from "@kyren/ui/components/status-glyph";
import { formatDueDate } from "@kyren/utils";
import { getModuleIcon } from "~/src/lib/module-icons";
import { paths } from "~/src/lib/paths";
import type { ShellModule } from "../app-sidebar";
import type { RecentItem } from "../use-recent";
import {
  groupClass,
  itemClass,
  Highlight,
  Shortcut,
  goKeys,
  type DocHit,
  type SearchHit,
  type TaskHit,
} from "./types";

type CommandPaletteResultsProps = {
  searching: boolean;
  trimmed: string;
  taskHits: TaskHit[];
  docs: DocHit[];
  searchResults: SearchHit[] | null;
  has: (id: string) => boolean;
  recentItems: RecentItem[];
  modules: ShellModule[];
  actions: Array<{ id: string; label: string; key?: string; run: () => void }>;
  resolvedTheme: string | undefined;
  go: (href: string) => void;
  done: (run: () => void) => void;
  toggleTheme: () => void;
  toggleDensity: () => void;
};

export function CommandPaletteResults({
  searching,
  trimmed,
  taskHits,
  docs,
  searchResults,
  has,
  recentItems,
  modules,
  actions,
  resolvedTheme,
  go,
  done,
  toggleTheme,
  toggleDensity,
}: CommandPaletteResultsProps) {
  const group = (heading: string, children: ReactNode) => (
    <Command.Group heading={heading} className={groupClass}>
      {children}
    </Command.Group>
  );

  return (
    <>
      {searching && taskHits.length > 0
        ? group(
            "Tasks",
            taskHits.map((task) => {
              const due = formatDueDate(task.due);

              return (
                <Command.Item
                  key={task.key}
                  value={`task ${task.key} ${task.name}`}
                  keywords={[task.name, task.key]}
                  onSelect={() => go(paths.task(task.key))}
                  className={itemClass}
                >
                  <StatusGlyph status={task.status} size={14} decorative />
                  <span className="font-mono text-xs text-ink-3">
                    {task.key}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    <Highlight text={task.name} query={trimmed} />
                  </span>
                  <span className="truncate text-xs text-ink-3">
                    {task.project}
                    {due.tone !== "none" ? ` · ${due.text}` : ""}
                  </span>
                </Command.Item>
              );
            }),
          )
        : null}

      {searching && docs.length > 0
        ? group(
            "Docs",
            docs.map((doc) => (
              <Command.Item
                key={doc.slug}
                value={`doc ${doc.slug} ${doc.title}`}
                keywords={[doc.title]}
                onSelect={() => go(paths.doc(doc.slug))}
                className={itemClass}
              >
                <FileTextIcon aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">
                  <Highlight text={doc.title} query={trimmed} />
                </span>
                {doc.project ? (
                  <span className="truncate text-xs text-ink-3">
                    {doc.project}
                  </span>
                ) : null}
              </Command.Item>
            )),
          )
        : null}

      {searching &&
      searchResults &&
      searchResults.some((r) => r.type === "project")
        ? group(
            "Projects",
            searchResults
              .filter((r) => r.type === "project")
              .map((proj) => (
                <Command.Item
                  key={proj.id}
                  value={`project ${proj.key ?? ""} ${proj.title}`}
                  keywords={[proj.title, proj.key ?? ""]}
                  onSelect={() => go(proj.href)}
                  className={itemClass}
                >
                  <FolderKanbanIcon aria-hidden="true" />
                  {proj.key ? (
                    <span className="font-mono text-xs text-ink-3">
                      {proj.key}
                    </span>
                  ) : null}
                  <span className="min-w-0 flex-1 truncate">
                    <Highlight text={proj.title} query={trimmed} />
                  </span>
                </Command.Item>
              )),
          )
        : null}

      {searching &&
      searchResults &&
      searchResults.some((r) => r.type === "channel")
        ? group(
            "Channels",
            searchResults
              .filter((r) => r.type === "channel")
              .map((chan) => (
                <Command.Item
                  key={chan.id}
                  value={`channel ${chan.title}`}
                  keywords={[chan.title]}
                  onSelect={() => go(chan.href)}
                  className={itemClass}
                >
                  <HashIcon aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">
                    <Highlight text={chan.title} query={trimmed} />
                  </span>
                  {chan.snippet ? (
                    <span className="truncate text-xs text-ink-3">
                      {chan.snippet}
                    </span>
                  ) : null}
                </Command.Item>
              )),
          )
        : null}

      {searching && has("docs") ? (
        <Command.Group className={groupClass}>
          <Command.Item
            value={`search-all ${trimmed}`}
            onSelect={() => go(paths.searchDocs(trimmed))}
            className={itemClass}
          >
            <SearchIcon aria-hidden="true" />
            Search all docs for “{trimmed}”
          </Command.Item>
        </Command.Group>
      ) : null}

      {!searching && recentItems.length > 0
        ? group(
            "Recent",
            recentItems.slice(0, 3).map((item: RecentItem) => (
              <Command.Item
                key={item.href}
                value={`recent ${item.label}`}
                onSelect={() => go(item.href)}
                className={itemClass}
              >
                <SearchIcon aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">
                  {item.label}
                </span>
              </Command.Item>
            )),
          )
        : null}

      {group(
        "Go to",
        modules.map((item) => {
          const Icon = getModuleIcon(item.icon);
          const shortcut = goKeys[item.id];

          return (
            <Command.Item
              key={item.id}
              value={`go ${item.label}`}
              onSelect={() => go(item.href)}
              className={itemClass}
            >
              <Icon aria-hidden="true" />
              {item.label}
              {shortcut ? <Shortcut keys={["G", shortcut]} /> : null}
            </Command.Item>
          );
        }),
      )}

      {actions.length
        ? group(
            "Create",
            actions.map((action) => (
              <Command.Item
                key={action.id}
                value={`create ${action.label}`}
                onSelect={() => done(action.run)}
                className={itemClass}
              >
                <PlusIcon aria-hidden="true" />
                {action.label}
                {action.key ? <Shortcut keys={[action.key]} /> : null}
              </Command.Item>
            )),
          )
        : null}

      {group(
        "Appearance",
        <>
          <Command.Item
            value="appearance toggle theme light dark"
            onSelect={() => done(toggleTheme)}
            className={itemClass}
          >
            {resolvedTheme === "dark" ? (
              <SunIcon aria-hidden="true" />
            ) : (
              <MoonIcon aria-hidden="true" />
            )}
            Toggle theme
            <Shortcut keys={["⇧⌘L"]} />
          </Command.Item>
          <Command.Item
            value="appearance toggle density compact comfortable"
            onSelect={() => done(toggleDensity)}
            className={itemClass}
          >
            <span aria-hidden="true" className="size-4" />
            Toggle density
            <Shortcut keys={["⇧⌘D"]} />
          </Command.Item>
        </>,
      )}
    </>
  );
}
