"use client";

import { useEffect, useMemo, useState } from "react";
import { useTrpcClient } from "@zentro/api/react";
import type { DocHit, SearchHit, TaskHit } from "./types";
import type { ShellModule } from "../app-sidebar";

type UseCommandPaletteSearchParams = {
  open: boolean;
  modules: ShellModule[];
};

export function useCommandPaletteSearch({
  open,
  modules,
}: UseCommandPaletteSearchParams) {
  const trpc = useTrpcClient();
  const [query, setQuery] = useState("");
  const [tasks, setTasks] = useState<TaskHit[] | null>(null);
  const [docs, setDocs] = useState<DocHit[]>([]);
  const [searchResults, setSearchResults] = useState<SearchHit[] | null>(null);

  const has = (id: string) => modules.some((item) => item.id === id);
  const trimmed = query.trim();

  // Tasks load once per opening; docs are searched as you type.
  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }

    if (!has("tasks") || tasks) return;

    void trpc.task.getTasksByOrgId
      .query({})
      .then((rows) =>
        setTasks(
          rows.map((row) => ({
            key: row.key,
            name: row.name,
            project: row.project,
            status: row.status,
            due: row.due ? new Date(row.due).toISOString() : null,
          })),
        ),
      )
      .catch(() => setTasks([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, trpc]);

  useEffect(() => {
    if (!open || !has("docs") || trimmed.length < 2) {
      setDocs([]);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      void trpc.docs.search
        .query({ query: trimmed })
        .then((rows) => {
          if (!cancelled) {
            setDocs(
              rows.slice(0, 5).map((row) => ({
                slug: row.slug,
                title: row.title,
                project: row.projectName,
              })),
            );
          }
        })
        .catch(() => {
          if (!cancelled) setDocs([]);
        });
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, trimmed, trpc]);

  useEffect(() => {
    if (!open || trimmed.length < 2) {
      setSearchResults(null);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      void trpc.search.query
        .query({ query: trimmed })
        .then((res) => {
          if (!cancelled) {
            setSearchResults(res);
          }
        })
        .catch(() => {
          if (!cancelled) setSearchResults(null);
        });
    }, 150);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, trimmed, trpc]);

  const taskHits = useMemo(() => {
    if (!trimmed || !tasks) return [];

    const needle = trimmed.toLowerCase();

    return tasks
      .filter(
        (task) =>
          task.name.toLowerCase().includes(needle) ||
          task.key.toLowerCase().includes(needle),
      )
      .slice(0, 5);
  }, [tasks, trimmed]);

  return {
    query,
    setQuery,
    trimmed,
    has,
    taskHits,
    docs,
    searchResults,
  };
}
