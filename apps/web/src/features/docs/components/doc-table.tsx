"use client";

import { Button } from "@zentro/ui/shadcn/button";
import Link from "next/link";
import type { FC } from "react";
import { FileTextIcon, CopyIcon } from "lucide-react";

import { toastSuccess } from "@zentro/ui/index";
import { ActorAvatar } from "~/src/components/actor-avatar";
import { StarButton } from "~/src/components/favorites/star-button";
import { apiPath, paths } from "~/src/lib/paths";
import { copyText } from "~/src/lib/clipboard";

import {
  formatDocDate,
  getDocOwner,
  getDocTitle,
  type DocsListItem,
} from "../lib/docs";
import { ProjectChip } from "./doc-rows";

/** Docs as structured rows: title, project, owner, edited, and actions. */
export const DocTable: FC<{ docs: DocsListItem[] }> = ({ docs }) => {
  const handleCopyLink = (e: React.MouseEvent, slug: string) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}${apiPath(`/docs/${slug}`)}`;
    void copyText(url).then((done) => {
      if (done) toastSuccess("Link copied to clipboard");
    });
  };

  return (
    <div
      role="table"
      aria-label="Docs"
      className="flex flex-col rounded-2xl border border-hairline bg-surface shadow-xs overflow-hidden dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]"
    >
      <div
        role="row"
        className="hidden h-10 items-center gap-3 border-b border-hairline bg-sunken/40 px-4 font-mono text-[11px] font-semibold tracking-[0.08em] text-ink-3 sm:flex"
      >
        <span role="columnheader" className="flex-1">
          DOCUMENT
        </span>
        <span role="columnheader" className="w-36">
          PROJECT
        </span>
        <span role="columnheader" className="w-40">
          OWNER
        </span>
        <span role="columnheader" className="w-24 text-right">
          UPDATED
        </span>
        <span role="columnheader" className="w-16 text-right">
          ACTIONS
        </span>
      </div>

      <div className="divide-y divide-hairline/60">
        {docs.map((doc) => {
          const owner = getDocOwner(doc);
          const title = getDocTitle(doc.title);

          return (
            <div
              role="row"
              key={doc.id}
              className="group relative flex min-h-12 items-center gap-3 px-4 py-2 hover:bg-hover transition-colors"
            >
              <span
                role="cell"
                className="flex min-w-0 flex-1 items-center gap-2.5"
              >
                <FileTextIcon
                  className="size-4 shrink-0 text-ink-3 group-hover:text-signal transition-colors"
                  aria-hidden="true"
                />
                <Link
                  href={paths.doc(doc.slug)}
                  className="line-clamp-2 text-[14px] font-medium break-words text-ink outline-none hover:text-signal sm:line-clamp-1"
                >
                  {title}
                </Link>
                {doc.excerpt && (
                  <span className="hidden lg:inline truncate text-xs text-ink-3 max-w-xs">
                    — {doc.excerpt}
                  </span>
                )}
              </span>

              <span role="cell" className="hidden w-36 sm:block">
                <ProjectChip doc={doc} />
              </span>

              <span
                role="cell"
                className="hidden w-40 items-center gap-2 text-xs sm:flex"
              >
                <ActorAvatar name={owner} size={20} />
                <span className="truncate text-ink-2">{owner}</span>
              </span>

              <span
                role="cell"
                className="w-24 text-right font-mono text-xs text-ink-3"
              >
                {formatDocDate(doc.updatedAt)}
              </span>

              <span
                role="cell"
                className="w-16 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Button
                  variant="custom"
                  type="button"
                  onClick={(e) => handleCopyLink(e, doc.slug)}
                  className="p-1 rounded text-ink-3 hover:text-ink hover:bg-muted"
                  title="Copy link"
                >
                  <CopyIcon className="size-3.5" />
                </Button>
                <StarButton
                  type="doc"
                  id={doc.id}
                  title={title}
                  href={`/docs/${doc.slug}`}
                  className="size-6 p-0.5"
                />
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
