"use client";

import { useState } from "react";
import { FileIcon } from "lucide-react";
import type { LibraryFile } from "./types";

export function FileThumb({
  file,
  large,
  compact,
}: {
  file: LibraryFile;
  large?: boolean;
  compact?: boolean;
}) {
  // A picture that can't be loaded (gone from storage) shows the plain
  // file icon instead of a broken image.
  const [failed, setFailed] = useState(false);
  const isImage = file.mimeType.startsWith("image/") && !failed;

  if (isImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={file.url}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
        className={
          large
            ? "size-full object-cover"
            : compact
              ? "size-7 shrink-0 rounded-md border border-line object-cover"
              : "size-10 rounded-md border border-line object-cover"
        }
      />
    );
  }

  return (
    <span
      className={
        large
          ? "flex size-full items-center justify-center bg-sunken text-ink-2"
          : compact
            ? "flex size-7 shrink-0 items-center justify-center rounded-md border border-line bg-sunken text-ink-2"
            : "flex size-10 items-center justify-center rounded-md border border-line bg-sunken text-ink-2"
      }
    >
      <FileIcon className={large ? "size-8" : "size-4"} aria-hidden />
    </span>
  );
}
