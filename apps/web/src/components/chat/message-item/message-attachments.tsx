"use client";

import { Button } from "@kyren/ui/shadcn/button";
import { FileIcon } from "lucide-react";
import { cn } from "@kyren/ui/lib/utils";
import { fileSize } from "../message-body";
import type { AttachmentView } from "./message-item-types";

function isImage(file: AttachmentView) {
  return ["image/png", "image/jpeg", "image/gif", "image/webp"].includes(
    file.mimeType,
  );
}

function extensionOf(file: AttachmentView) {
  return (file.name.split(".").pop() ?? "file").slice(0, 4).toUpperCase();
}

/** Images as a grid, other files as cards; both open the file preview. */
export function Attachments({
  files,
  onOpen,
}: {
  files: AttachmentView[];
  onOpen: (file: AttachmentView, all: AttachmentView[]) => void;
}) {
  const images = files.filter(isImage);
  const others = files.filter((file) => !isImage(file));

  return (
    <div className="mt-1.5 flex flex-col gap-2">
      {images.length ? (
        <div
          className={cn(
            "grid max-w-md gap-1.5",
            images.length === 1 ? "grid-cols-1" : "grid-cols-2",
          )}
        >
          {images.slice(0, 4).map((file) => (
            <Button
              variant="custom"
              key={file.id}
              type="button"
              onClick={() => onOpen(file, files)}
              aria-label={`Open ${file.name}`}
              className="group relative overflow-hidden rounded-lg border border-hairline bg-sunken outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={file.url}
                alt={file.name}
                loading="lazy"
                width={file.width ?? undefined}
                height={file.height ?? undefined}
                className={cn(
                  "w-full object-cover",
                  images.length === 1 ? "max-h-72" : "aspect-[4/3]",
                )}
              />
              <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-scrim to-transparent px-2 pt-4 pb-1 text-left font-mono text-[11px] text-on-signal opacity-0 group-hover:opacity-100">
                {file.name}
              </span>
            </Button>
          ))}
        </div>
      ) : null}
      {others.map((file) => (
        <Button
          variant="custom"
          key={file.id}
          type="button"
          onClick={() => onOpen(file, files)}
          className="flex w-full max-w-md items-center gap-3 rounded-lg border border-hairline bg-surface p-2.5 text-left outline-none hover:border-ink-3 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex size-10 items-center justify-center rounded-md bg-tint-docs font-mono text-[10px]">
            {extensionOf(file)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">
              {file.name}
            </span>
            <span className="block font-mono text-[11px] text-ink-3">
              {fileSize(file.size)}
            </span>
          </span>
          <FileIcon className="size-4 text-ink-3" aria-hidden="true" />
        </Button>
      ))}
    </div>
  );
}
