"use client";

import dynamic from "next/dynamic";

import { DocPageSkeleton } from "./doc-page-skeleton";

/**
 * TipTap only exists in the browser. Loading the editor through next/dynamic
 * with ssr disabled keeps its extensions and ProseMirror out of the server
 * bundle and out of the docs page's initial client chunks.
 */
export const NotionEditorPage = dynamic(
  () => import("./notion-editor-page").then((mod) => mod.NotionEditorPage),
  {
    ssr: false,
    loading: () => <DocPageSkeleton />,
  },
);
