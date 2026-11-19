"use client";

import { useCallback, useEffect, useState } from "react";

import { useTrpcClient } from "@zentro/api/react";
import { toastError, toastSuccess } from "@zentro/ui/index";
import { Button } from "@zentro/ui/shadcn/button";
import { Input } from "@zentro/ui/shadcn/input";
import { Textarea } from "@zentro/ui/shadcn/textarea";
import { NativeSelect } from "@zentro/ui/shadcn/native-select";

import { useAsyncData } from "~/src/lib/use-async-data";

type Article = {
  id: string;
  title: string;
  slug: string;
  body: string;
  status: string;
  audience: string;
};

const blank = {
  id: undefined as string | undefined,
  title: "",
  body: "",
  status: "draft" as "draft" | "published",
  audience: "public" as "internal" | "public",
};

/** For people who manage help articles: write, publish and remove them. */
export function KnowledgeBase() {
  const trpc = useTrpcClient();
  const [articles, setArticles] = useState<Article[]>([]);
  const [draft, setDraft] = useState(blank);
  const [busy, setBusy] = useState(false);
  // Bumped after every change, so the open history reloads.
  const [version, setVersion] = useState(0);

  const load = useCallback(async () => {
    try {
      setArticles(await trpc.kb.list.query({}));
    } catch {
      // Optional; the queue works without it.
    }
  }, [trpc]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(work: () => Promise<unknown>, done: string) {
    setBusy(true);

    try {
      await work();
      toastSuccess(done);
      setVersion((v) => v + 1);
      await load();
    } catch (error) {
      toastError(error, "Could not save the article.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="rounded-xl border border-line px-4 py-3">
      <summary className="cursor-pointer text-sm font-medium text-ink">
        Help articles
      </summary>
      <p className="mt-2 text-sm text-ink-2">
        Public, published articles appear on your help centre at /help. Internal
        ones are for your team to paste into replies.
      </p>

      <ul className="mt-3 flex flex-col gap-1 text-sm">
        {articles.map((article) => (
          <li key={article.id} className="flex items-center gap-2">
            <button
              type="button"
              disabled={busy}
              className="flex-1 truncate text-left text-ink hover:underline disabled:opacity-60"
              onClick={() =>
                setDraft({
                  id: article.id,
                  title: article.title,
                  body: article.body,
                  status: article.status as "draft",
                  audience: article.audience as "public",
                })
              }
            >
              {article.title}
            </button>
            <span className="text-xs text-ink-2">
              {article.status} · {article.audience}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              aria-label={`Move ${article.title} to the trash`}
              onClick={() =>
                void run(async () => {
                  await trpc.kb.remove.mutate({ id: article.id });

                  if (draft.id === article.id) setDraft(blank);
                }, "Moved to the trash")
              }
            >
              Trash
            </Button>
          </li>
        ))}
      </ul>

      <form
        className="mt-3 flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void run(async () => {
            await trpc.kb.save.mutate(draft);
            setDraft(blank);
          }, "Article saved");
        }}
      >
        <Input
          aria-label="Article title"
          placeholder="Article title"
          maxLength={150}
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
        />
        <Textarea
          aria-label="Article text"
          rows={5}
          maxLength={20000}
          placeholder="Plain text"
          value={draft.body}
          onChange={(e) => setDraft({ ...draft, body: e.target.value })}
        />
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <NativeSelect
            aria-label="Audience"
            size="sm"
            className="w-28 capitalize"
            value={draft.audience}
            onChange={(e) =>
              setDraft({ ...draft, audience: e.target.value as "public" })
            }
          >
            <option value="public">Public</option>
            <option value="internal">Internal</option>
          </NativeSelect>
          <NativeSelect
            aria-label="Status"
            size="sm"
            className="w-28 capitalize"
            value={draft.status}
            onChange={(e) =>
              setDraft({ ...draft, status: e.target.value as "draft" })
            }
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </NativeSelect>
          <Button
            type="submit"
            size="sm"
            disabled={busy || !draft.title.trim()}
          >
            {draft.id ? "Save changes" : "Add article"}
          </Button>
          {draft.id ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setDraft(blank)}
            >
              New article
            </Button>
          ) : null}
        </div>
      </form>

      {draft.id ? (
        <Revisions
          key={`${draft.id}-${version}`}
          articleId={draft.id}
          busy={busy}
          onRestore={(revisionId) => {
            const saved = articles.find((article) => article.id === draft.id);
            const unsaved =
              !saved ||
              saved.title !== draft.title ||
              saved.body !== draft.body;

            if (
              unsaved &&
              !window.confirm(
                "Restore this version? Your unsaved changes will be lost.",
              )
            ) {
              return;
            }

            void run(async () => {
              const restored = await trpc.kb.restoreRevision.mutate({
                revisionId,
              });

              setDraft({
                id: restored.id,
                title: restored.title,
                body: restored.body,
                status: restored.status as "draft",
                audience: restored.audience as "public",
              });
            }, "Earlier version restored");
          }}
        />
      ) : null}

      <Trash key={version} busy={busy} run={run} />
    </details>
  );
}

const when = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

/** Earlier versions of the article being edited, each one restorable. */
function Revisions({
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
function Trash({
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
