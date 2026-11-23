"use client";

import { Button } from "@zentro/ui/shadcn/button";
import Link from "next/link";
import { useMemo, type FC } from "react";
import { CopyIcon, FolderIcon, SparklesIcon } from "lucide-react";

import { cn } from "@zentro/ui/lib/utils";
import { toastSuccess } from "@zentro/ui/index";

import { ActorAvatar } from "~/src/components/actor-avatar";
import { StarButton } from "~/src/components/favorites/star-button";
import { apiPath, paths } from "~/src/lib/paths";
import { copyText } from "~/src/lib/clipboard";

import {
  formatDocDate,
  getDocOwner,
  getDocProject,
  getDocTitle,
  type DocsListItem,
} from "../lib/docs";

export { DocTable } from "./doc-table";

const projectTints = [
  "bg-tint-tasks",
  "bg-tint-projects",
  "bg-tint-docs",
  "bg-tint-teams",
  "bg-tint-audit",
] as const;

function tintFor(seed: string) {
  let hash = 0;

  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;

  return projectTints[hash % projectTints.length];
}

/** The project as a small tinted mono chip, or "No project". */
export function ProjectChip({ doc }: { doc: DocsListItem }) {
  if (!doc.projectName) {
    return (
      <span className="inline-flex items-center gap-1 rounded-sm border border-hairline/60 bg-muted/40 px-1.5 py-0.5 font-mono text-[10px] text-ink-3">
        Workspace
      </span>
    );
  }

  return (
    <span
      title={doc.projectName}
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-sm border border-hairline px-1.5 py-0.5 font-mono text-[10px] text-ink font-medium shadow-2xs",
        tintFor(doc.projectName),
      )}
    >
      <span className="size-1.5 rounded-full bg-ink/60" />
      <span className="truncate">{doc.projectKey ?? getDocProject(doc)}</span>
    </span>
  );
}

/** Docs as clean modern cards with star favorites and hover tools. */
export const DocTiles: FC<{ docs: DocsListItem[]; columns?: string }> = ({
  docs,
  columns = "sm:grid-cols-2 xl:grid-cols-4",
}) => {
  const handleCopyLink = (e: React.MouseEvent, slug: string) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}${apiPath(`/docs/${slug}`)}`;
    void copyText(url).then((done) => {
      if (done) toastSuccess("Link copied to clipboard");
    });
  };

  return (
    <div className={cn("grid grid-cols-1 gap-3.5", columns)}>
      {docs.map((doc) => {
        const owner = getDocOwner(doc);
        const title = getDocTitle(doc.title);
        const isSpec =
          title.toLowerCase().includes("spec") ||
          title.toLowerCase().includes("prd") ||
          title.toLowerCase().includes("rfc");

        return (
          <div
            key={doc.id}
            className="group relative flex min-w-0 min-h-[175px] flex-col justify-between rounded-2xl border border-hairline bg-surface p-5 shadow-xs transition-all hover:border-hairline-strong hover:shadow-sm hover:-translate-y-0.5 focus-within:ring-2 focus-within:ring-ring dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]"
          >
            {/* Top Bar with Project Chip & Quick Actions */}
            <div className="flex items-center justify-between gap-2 mb-3">
              <ProjectChip doc={doc} />

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="custom"
                  type="button"
                  onClick={(e) => handleCopyLink(e, doc.slug)}
                  className="p-1 rounded text-ink-3 hover:text-ink hover:bg-hover transition-colors"
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
              </div>
            </div>

            {/* Document Title & Excerpt */}
            <div className="flex-1 min-w-0">
              <Link
                href={paths.doc(doc.slug)}
                className="flex items-center gap-2 text-[15px] font-semibold text-ink group-hover:text-signal tracking-tight transition-colors outline-none"
              >
                {isSpec && (
                  <SparklesIcon className="size-3.5 text-warning-text shrink-0" />
                )}
                <span className="truncate">{title}</span>
              </Link>

              {doc.excerpt ? (
                <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-ink-2">
                  {doc.excerpt}
                </p>
              ) : (
                <p className="mt-2 text-xs text-ink-3 italic">
                  No preview text available
                </p>
              )}
            </div>

            {/* Footer with Creator & Relative Timestamp */}
            <div className="mt-4 flex items-center justify-between pt-3 border-t border-hairline/60 text-xs text-ink-2">
              <div className="flex items-center gap-2 min-w-0">
                <ActorAvatar name={owner} size={20} />
                <span className="truncate text-xs text-ink-3 font-medium">
                  {owner}
                </span>
              </div>
              <span className="font-mono text-[11px] text-ink-3 shrink-0">
                {formatDocDate(doc.updatedAt)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

/** Docs grouped by project cluster. */
export const DocGrouped: FC<{ docs: DocsListItem[] }> = ({ docs }) => {
  const groups = useMemo(() => {
    const map = new Map<string, DocsListItem[]>();
    for (const doc of docs) {
      const key = doc.projectName || "Workspace Docs";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(doc);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [docs]);

  return (
    <div className="flex flex-col gap-6">
      {groups.map(([projectName, projectDocs]) => (
        <div key={projectName} className="flex flex-col gap-3">
          <div className="flex items-center gap-2 pb-1 border-b border-hairline/80">
            <div className="flex size-6 items-center justify-center rounded-md bg-tint-projects font-mono text-[10px] text-ink">
              <FolderIcon className="size-3.5" />
            </div>
            <h3 className="font-semibold text-sm text-ink">{projectName}</h3>
            <span className="font-mono text-xs text-ink-3">
              ({projectDocs.length})
            </span>
          </div>

          <DocTiles
            docs={projectDocs}
            columns="sm:grid-cols-2 xl:grid-cols-3"
          />
        </div>
      ))}
    </div>
  );
};
