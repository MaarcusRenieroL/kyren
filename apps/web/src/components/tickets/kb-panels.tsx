"use client";

import { useTrpcClient } from "@kyren/api/react";
import { Button } from "@kyren/ui/shadcn/button";

import { useAsyncData } from "~/src/lib/use-async-data";

const when = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

/** Earlier versions of the article being edited, each one restorable. */
export function Revisions({
  articleId,
  busy,
  onRestore,
}: {
  articleId: string;
  busy: boolean;
  onRestore: (revisionId: string) => void;
}) {
  const trpc = useTrpcClient();
  const history = useAsyncData(
    () => trpc.kb.revisions.query({ id: articleId }),
    [trpc, articleId],
  );

  return (
    <section aria-label="Earlier versions" className="mt-4 flex flex-col gap-2">
      <h3 className="text-sm font-medium text-ink">Earlier versions</h3>
      {history.error ? (
        <p role="alert" className="text-xs text-danger-text">
          Could not load the earlier versions.
        </p>
      ) : !history.data ? (
        <p className="text-xs text-ink-3">Loading…</p>
      ) : !history.data.length ? (
        <p className="text-xs text-ink-3">
          No earlier versions yet. Each saved change keeps the one before it.
        </p>
      ) : (
        <ol className="flex flex-col gap-2">
          {history.data.map((revision) => (
            <li
              key={revision.id}
              className="flex flex-col gap-1 rounded-md border border-line p-2 text-xs"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-ink">{revision.title}</span>
                <span className="text-ink-3">
                  {revision.editedBy ?? "Former member"} ·{" "}
                  {when.format(new Date(revision.editedAt))}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto"
                  disabled={busy}
                  aria-label={`Restore the version from ${when.format(new Date(revision.editedAt))}`}
                  onClick={() => onRestore(revision.id)}
                >
                  Restore
                </Button>
              </div>
              <p className="line-clamp-3 whitespace-pre-wrap text-ink-2">
                {revision.body || "(no text)"}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** Trashed articles: restore one, or delete it for good. */
export function Trash({
  busy,
  run,
}: {
  busy: boolean;
  run: (work: () => Promise<unknown>, done: string) => Promise<void>;
}) {
  const trpc = useTrpcClient();
  const trashed = useAsyncData(() => trpc.kb.trash.query({}), [trpc]);

  if (!trashed.data?.length) return null;

  return (
    <section aria-label="Trashed articles" className="mt-4 flex flex-col gap-2">
      <h3 className="text-sm font-medium text-ink">Trash</h3>
      <ul className="flex flex-col gap-1 text-sm">
        {trashed.data.map((article) => (
          <li key={article.id} className="flex items-center gap-2">
            <span className="flex-1 truncate text-ink-2">{article.title}</span>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              aria-label={`Restore ${article.title}`}
              onClick={() =>
                void run(
                  () => trpc.kb.untrash.mutate({ id: article.id }),
                  "Article restored",
                )
              }
            >
              Restore
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              aria-label={`Delete ${article.title} for good`}
              onClick={() => {
                if (
                  !window.confirm(
                    `Delete "${article.title}" and its earlier versions for good? This cannot be undone.`,
                  )
                ) {
                  return;
                }

                void run(
                  () => trpc.kb.purge.mutate({ id: article.id }),
                  "Article deleted for good",
                );
              }}
            >
              Delete forever
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
