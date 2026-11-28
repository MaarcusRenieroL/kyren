"use client";

import dynamic from "next/dynamic";

/**
 * TipTap and ProseMirror are browser-only. The wrapper keeps them out of the
 * tasks route's initial bundle; the editor chunk arrives when it is mounted.
 */
export const RichTextEditor = dynamic(
  () =>
    import("@kyren/ui/components/rich-text-editor").then(
      (mod) => mod.RichTextEditor,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-44 animate-pulse rounded-md border bg-muted/40" />
    ),
  },
);
