"use client";

import { SearchIcon, StarIcon } from "lucide-react";
import { Button } from "@kyren/ui/shadcn/button";
import { Input } from "@kyren/ui/shadcn/input";

import { emptyCopy, stamp, type Folder, type Row } from "./mail-types";
import { MailMobileHeader } from "./mail-sidebar-nav";

export function MailListPanel({
  folder,
  setFolder,
  search,
  setSearch,
  rows,
  cursor,
  loadingOlder,
  failed,
  openId,
  onOpenRow,
  onLoadOlder,
  onRetry,
  onCompose,
}: {
  folder: Folder;
  setFolder: (f: Folder) => void;
  search: string;
  setSearch: (s: string) => void;
  rows: Row[] | null;
  cursor: string | null;
  loadingOlder: boolean;
  failed: boolean;
  openId: string | null;
  onOpenRow: (row: Row) => void;
  onLoadOlder: () => void;
  onRetry: () => void;
  onCompose: () => void;
}) {
  return (
    <section
      aria-label="Messages"
      className={`min-w-0 flex-col border-r border-line md:flex md:w-80 md:shrink-0 lg:w-96 ${openId ? "hidden" : "flex w-full"}`}
    >
      <MailMobileHeader
        folder={folder}
        setFolder={setFolder}
        onCompose={onCompose}
      />
      <div className="relative border-b border-line p-3">
        <SearchIcon
          className="pointer-events-none absolute top-1/2 left-6 size-4 -translate-y-1/2 text-ink-3"
          aria-hidden
        />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search mail"
          aria-label="Search mail"
          className="pl-9"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {failed ? (
          <p role="alert" className="p-4 text-sm">
            Mail did not load.{" "}
            <Button variant="custom" className="underline" onClick={onRetry}>
              Retry
            </Button>
          </p>
        ) : rows === null ? (
          <p role="status" className="p-4 text-sm text-ink-2">
            Loading…
          </p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-center text-sm text-ink-2">
            {search ? "No messages match." : emptyCopy[folder]}
          </p>
        ) : (
          <ul>
            {rows.map((row) => (
              <li key={row.id} className="border-b border-line">
                <Button
                  variant="custom"
                  type="button"
                  onClick={() => onOpenRow(row)}
                  aria-current={openId === row.id ? "true" : undefined}
                  className={`flex w-full flex-col gap-0.5 px-4 py-3 text-left hover:bg-sunken ${openId === row.id ? "bg-sunken" : ""}`}
                >
                  <span className="flex items-center gap-2">
                    {row.unread ? (
                      <span
                        className="size-2 shrink-0 rounded-full bg-accent"
                        role="img"
                        aria-label="Unread"
                      />
                    ) : null}
                    <span
                      className={`truncate text-sm ${row.unread ? "font-semibold text-ink" : "text-ink-2"}`}
                    >
                      {folder === "sent" || folder === "drafts"
                        ? `To: ${row.to.join(", ") || "No recipient"}`
                        : row.from}
                    </span>
                    {row.starred ? (
                      <StarIcon
                        className="size-3.5 shrink-0 fill-warning text-warning"
                        aria-label="Starred"
                      />
                    ) : null}
                    <span className="ml-auto shrink-0 text-xs text-ink-3">
                      {stamp.format(new Date(row.at))}
                    </span>
                  </span>
                  <span
                    className={`truncate text-sm ${row.unread ? "font-medium" : ""}`}
                  >
                    {row.draft ? "Draft · " : ""}
                    {row.subject}
                  </span>
                  <span className="truncate text-xs text-ink-3">
                    {row.snippet}
                  </span>
                </Button>
              </li>
            ))}
            {cursor ? (
              <li className="p-3 text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={loadingOlder}
                  onClick={onLoadOlder}
                >
                  {loadingOlder ? "Loading…" : "Load older messages"}
                </Button>
              </li>
            ) : null}
          </ul>
        )}
      </div>
    </section>
  );
}
