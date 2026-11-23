"use client";

import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@zentro/ui/shadcn/collapsible";
import { useCallback, useEffect, useState } from "react";

import { useTrpcClient } from "@zentro/api/react";
import { toastError, toastSuccess } from "@zentro/ui/index";
import { Button } from "@zentro/ui/shadcn/button";
import { Input } from "@zentro/ui/shadcn/input";
import { Textarea } from "@zentro/ui/shadcn/textarea";
import { NativeSelect } from "@zentro/ui/shadcn/native-select";

import { Revisions, Trash } from "./kb-panels";

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
    <Collapsible
      role="group"
      className="rounded-xl border border-line px-4 py-3"
    >
      <CollapsibleTrigger className="w-full text-left before:mr-2 before:inline-block before:content-['▸'] data-[state=open]:before:rotate-90 cursor-pointer text-sm font-medium text-ink">
        Help articles
      </CollapsibleTrigger>
      <CollapsibleContent forceMount className="data-[state=closed]:hidden">
        <p className="mt-2 text-sm text-ink-2">
          Public, published articles appear on your help centre at /help.
          Internal ones are for your team to paste into replies.
        </p>

        <ul className="mt-3 flex flex-col gap-1 text-sm">
          {articles.map((article) => (
            <li key={article.id} className="flex items-center gap-2">
              <Button
                variant="custom"
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
              </Button>
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
      </CollapsibleContent>
    </Collapsible>
  );
}
