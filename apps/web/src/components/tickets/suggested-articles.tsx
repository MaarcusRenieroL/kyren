"use client";

import { useEffect, useState } from "react";

import { useTrpcClient } from "@zentro/api/react";

type Suggestion = {
  id: string;
  title: string;
  body: string;
  audience: "internal" | "public";
};

/**
 * Help articles that mention the ticket's subject. A public article goes into
 * the reply in one click; an internal one only opens here for the agent to
 * read, so staff-only text never lands in a customer's inbox by accident.
 */
export function SuggestedArticles({
  subject,
  onInsert,
}: {
  subject: string;
  onInsert: (text: string) => void;
}) {
  const trpc = useTrpcClient();
  const [found, setFound] = useState<Suggestion[]>([]);
  const [reading, setReading] = useState<Suggestion | null>(null);

  useEffect(() => {
    let current = true;

    trpc.kb.suggest
      .query({ query: subject })
      .then((rows) => current && setFound(rows as Suggestion[]))
      .catch(() => undefined);

    return () => {
      current = false;
    };
  }, [trpc, subject]);

  if (found.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 text-xs text-ink-2">
      <div className="flex flex-wrap items-center gap-2">
        <span>Suggested articles:</span>
        {found.map((article) =>
          article.audience === "public" ? (
            <button
              key={article.id}
              type="button"
              className="rounded-md border border-line px-2 py-1 text-ink hover:bg-sunken"
              onClick={() => onInsert(article.body)}
            >
              {article.title}
            </button>
          ) : (
            <button
              key={article.id}
              type="button"
              aria-expanded={reading?.id === article.id}
              className="rounded-md border border-dashed border-line px-2 py-1 text-ink hover:bg-sunken"
              onClick={() =>
                setReading(reading?.id === article.id ? null : article)
              }
            >
              {article.title} · internal
            </button>
          ),
        )}
      </div>
      {reading ? (
        <div className="rounded-md border border-dashed border-line p-2">
          <p className="mb-1 font-medium text-ink">
            Internal article, for you only. It is not added to the reply.
          </p>
          <p className="whitespace-pre-wrap">{reading.body}</p>
        </div>
      ) : null}
    </div>
  );
}
