"use client";

import { useCallback, useEffect, useState } from "react";

import { useTrpcClient } from "@zentro/api/react";
import { toastError, toastSuccess } from "@zentro/ui/index";
import { Button } from "@zentro/ui/shadcn/button";
import { Input } from "@zentro/ui/shadcn/input";
import { Textarea } from "@zentro/ui/shadcn/textarea";

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
              className="flex-1 truncate text-left text-ink hover:underline"
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
              onClick={() =>
                void run(
                  () => trpc.kb.remove.mutate({ id: article.id }),
                  "Article deleted",
                )
              }
            >
              Delete
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
          <select
            aria-label="Audience"
            className="rounded-md border border-line bg-surface px-2 py-1"
            value={draft.audience}
            onChange={(e) =>
              setDraft({ ...draft, audience: e.target.value as "public" })
            }
          >
            <option value="public">Public</option>
            <option value="internal">Internal</option>
          </select>
          <select
            aria-label="Status"
            className="rounded-md border border-line bg-surface px-2 py-1"
            value={draft.status}
            onChange={(e) =>
              setDraft({ ...draft, status: e.target.value as "draft" })
            }
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
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
    </details>
  );
}
