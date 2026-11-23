"use client";

import { PenSquareIcon } from "lucide-react";
import { Button } from "@kyren/ui/shadcn/button";
import { NativeSelect } from "@kyren/ui/shadcn/native-select";

import { folders, type Folder } from "./mail-types";

export function MailSidebarNav({
  folder,
  setFolder,
  unread,
  onCompose,
}: {
  folder: Folder;
  setFolder: (f: Folder) => void;
  unread: number;
  onCompose: () => void;
}) {
  return (
    <nav
      aria-label="Mail folders"
      className="hidden w-52 shrink-0 flex-col gap-1 border-r border-line p-3 lg:flex"
    >
      <Button className="mb-2" onClick={onCompose}>
        <PenSquareIcon aria-hidden />
        Compose
      </Button>
      {folders.map(({ id, label, icon: Icon }) => (
        <Button
          variant="custom"
          key={id}
          type="button"
          aria-current={folder === id ? "page" : undefined}
          onClick={() => setFolder(id)}
          className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${folder === id ? "bg-sunken font-medium text-ink" : "text-ink-2 hover:bg-sunken"}`}
        >
          <Icon className="size-4" aria-hidden />
          {label}
          {id === "inbox" && unread > 0 ? (
            <span className="ml-auto rounded-full bg-ink px-1.5 text-xs text-canvas">
              {unread}
            </span>
          ) : null}
        </Button>
      ))}
    </nav>
  );
}

export function MailMobileHeader({
  folder,
  setFolder,
  onCompose,
}: {
  folder: Folder;
  setFolder: (f: Folder) => void;
  onCompose: () => void;
}) {
  return (
    <div className="flex items-center gap-2 border-b border-line p-3 lg:hidden">
      <NativeSelect
        aria-label="Folder"
        value={folder}
        onChange={(event) => setFolder(event.target.value as Folder)}
        className="flex-1 text-sm"
      >
        {folders.map(({ id, label }) => (
          <option key={id} value={id}>
            {label}
          </option>
        ))}
      </NativeSelect>
      <Button size="sm" onClick={onCompose}>
        Compose
      </Button>
    </div>
  );
}
