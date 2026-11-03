"use client";

import { useEffect, useState } from "react";

import { useTrpcClient } from "@zentro/api/react";

type Suggestion = { id: string; title: string; body: string };

/** Help articles that mention the ticket's subject; one click puts the text into the reply. */
export function SuggestedArticles({
  subject,
  onInsert,
}: {
  subject: string;
  onInsert: (text: string) => void;
}) {
  const trpc = useTrpcClient();
  const [found, setFound] = useState<Suggestion[]>([]);

  useEffect(() => {
    let current = true;

    trpc.kb.suggest
      .query({ query: subject })
      .then((rows) => current && setFound(rows))
      .catch(() => undefined);

    return () => {
      current = false;
    };
  }, [trpc, subject]);

  if (found.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-ink-2">
      <span>Suggested articles:</span>
      {found.map((article) => (
        <button
          key={article.id}
          type="button"
          className="rounded-md border border-line px-2 py-1 text-ink hover:bg-sunken"
          onClick={() => onInsert(article.body)}
        >
          {article.title}
        </button>
      ))}
    </div>
  );
}
