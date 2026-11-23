"use client";

import { Button } from "@kyren/ui/shadcn/button";
import { FileIcon, XIcon } from "lucide-react";
import { cn } from "@kyren/ui/lib/utils";
import { fileSize } from "../message-body";
import type { PendingFile } from "./composer-types";

type ComposerAttachmentsProps = {
  pending: PendingFile[];
  onRemove: (key: string) => void;
};

export function ComposerAttachments({
  pending,
  onRemove,
}: ComposerAttachmentsProps) {
  if (!pending.length) return null;

  return (
    <ul className="flex flex-wrap gap-2 px-3 pt-3">
      {pending.map((file) => (
        <li
          key={file.key}
          className={cn(
            "relative flex w-56 items-center gap-2.5 rounded-lg border bg-canvas p-2",
            file.error ? "border-danger" : "border-hairline",
          )}
        >
          {file.previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={file.previewUrl}
              alt=""
              className="size-10 rounded-sm object-cover"
            />
          ) : (
            <span className="flex size-10 items-center justify-center rounded-sm bg-tint-docs">
              <FileIcon className="size-4" aria-hidden="true" />
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium">
              {file.name}
            </span>
            <span
              className={cn(
                "block font-mono text-[11px]",
                file.error ? "text-danger-text" : "text-ink-3",
              )}
            >
              {file.error
                ? file.error
                : file.id
                  ? `${fileSize(file.size)} · ready`
                  : `${Math.round(file.progress * 100)}% of ${fileSize(file.size)}`}
            </span>
            {!file.id && !file.error ? (
              <span className="mt-1 block h-1 overflow-hidden rounded-full bg-sunken">
                <span
                  className="block h-full rounded-full bg-signal transition-[width]"
                  style={{ width: `${file.progress * 100}%` }}
                />
              </span>
            ) : null}
          </span>
          <Button
            variant="custom"
            type="button"
            aria-label={`Remove ${file.name}`}
            onClick={() => onRemove(file.key)}
            className="rounded-xs p-0.5 text-ink-3 hover:text-ink focus-visible:ring-2 focus-visible:ring-ring"
          >
            <XIcon className="size-3.5" />
          </Button>
        </li>
      ))}
    </ul>
  );
}
