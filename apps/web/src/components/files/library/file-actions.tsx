"use client";

import type { FC } from "react";
import { DownloadIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { Button } from "@kyren/ui/shadcn/button";
import { Input } from "@kyren/ui/shadcn/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@kyren/ui/shadcn/select";
import type { Folder, LibraryFile } from "./types";

type FileActionsProps = {
  file: LibraryFile;
  folders: Folder[];
  onMove: (file: LibraryFile, target: string) => void;
  onStartRename: (file: LibraryFile) => void;
  onRemove: (file: LibraryFile) => void;
};

export const FileActions: FC<FileActionsProps> = ({
  file,
  folders,
  onMove,
  onStartRename,
  onRemove,
}) => {
  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon-sm" asChild>
        <a
          href={file.url}
          download={file.name}
          aria-label={`Download ${file.name}`}
        >
          <DownloadIcon aria-hidden />
        </a>
      </Button>
      {file.canManage && folders.length ? (
        <Select
          value={file.folderId ?? "root"}
          onValueChange={(value) => onMove(file, value === "root" ? "" : value)}
        >
          <SelectTrigger
            aria-label={`Move ${file.name}`}
            className="h-8 w-36 text-xs"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="root">No folder</SelectItem>
            {folders.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
      {file.canManage ? (
        <>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Rename ${file.name}`}
            onClick={() => onStartRename(file)}
          >
            <PencilIcon aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Delete ${file.name}`}
            onClick={() => onRemove(file)}
          >
            <Trash2Icon aria-hidden />
          </Button>
        </>
      ) : null}
    </div>
  );
};

type FileNameProps = {
  file: LibraryFile;
  isRenaming: boolean;
  draft: string;
  onDraftChange: (value: string) => void;
  onSaveRename: (file: LibraryFile) => void;
  onCancelRename: () => void;
};

export const FileName: FC<FileNameProps> = ({
  file,
  isRenaming,
  draft,
  onDraftChange,
  onSaveRename,
  onCancelRename,
}) => {
  if (isRenaming) {
    return (
      <Input
        autoFocus
        value={draft}
        aria-label="File name"
        onChange={(event) => onDraftChange(event.target.value)}
        onBlur={() => onSaveRename(file)}
        onKeyDown={(event) => {
          if (event.key === "Enter") onSaveRename(file);
          if (event.key === "Escape") onCancelRename();
        }}
      />
    );
  }

  return (
    <a
      href={file.url}
      target="_blank"
      rel="noreferrer"
      className="line-clamp-2 text-sm font-medium break-all text-ink hover:underline sm:line-clamp-1"
    >
      {file.name}
    </a>
  );
};
