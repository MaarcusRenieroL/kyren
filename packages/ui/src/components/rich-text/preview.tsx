"use client";

import { sanitizeRichText } from "@kyren/utils";
import { cn } from "../../lib/utils";
import { richTextContentClassName, type RichTextPreviewProps } from "./styles";

export function RichTextPreview({
  value,
  emptyLabel = "Edit description",
  className,
}: RichTextPreviewProps) {
  if (!value) {
    return (
      <div
        className={cn(
          "min-h-24 rounded-md p-3 text-sm text-muted-foreground",
          className,
        )}
      >
        {emptyLabel}
      </div>
    );
  }

  return (
    <div
      className={cn(
        richTextContentClassName,
        "min-h-24 rounded-md p-3",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: sanitizeRichText(value) }}
    />
  );
}
