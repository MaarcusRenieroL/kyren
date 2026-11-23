import { useEffect, useMemo, useState } from "react";
import { useTrpcClient } from "@kyren/api/react";
import type { DocsListItem } from "../../../lib/docs";

export type Sort = "edited" | "title" | "project";
export type ViewMode = "table" | "grid" | "grouped";

export function useDashboardDocs() {
  const trpc = useTrpcClient();
  const [docs, setDocs] = useState<DocsListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [sort, setSort] = useState<Sort>("edited");
  const [view, setView] = useState<ViewMode>("grid");
  const [attempt, setAttempt] = useState(0);
  const [project, setProject] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  useEffect(() => {
    let live = true;
    setIsLoading(true);
    trpc.docs.getAll
      .query({})
      .then((list) => {
        if (live) {
          setDocs(list);
          setFailed(false);
        }
      })
      .catch(() => live && setFailed(true))
      .finally(() => live && setIsLoading(false));

    return () => {
      live = false;
    };
  }, [trpc, attempt]);

  const projectsList = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of docs) {
      if (d.projectName) {
        map.set(d.projectName, (map.get(d.projectName) ?? 0) + 1);
      }
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [docs]);

  const recentDocs = useMemo(() => {
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return docs.filter((d) => d.updatedAt.getTime() > oneWeekAgo);
  }, [docs]);

  const recentStrip = useMemo(
    () =>
      [...docs]
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
        .slice(0, 4),
    [docs],
  );

  const filterCounts = useMemo(() => {
    const specs = docs.filter((d) => {
      const t = d.title.toLowerCase();
      return (
        t.includes("spec") ||
        t.includes("prd") ||
        t.includes("rfc") ||
        t.includes("design")
      );
    }).length;

    const meetings = docs.filter((d) => {
      const t = d.title.toLowerCase();
      return (
        t.includes("meeting") ||
        t.includes("sync") ||
        t.includes("notes") ||
        t.includes("retro")
      );
    }).length;

    return {
      all: docs.length,
      specs,
      meetings,
      recent: recentDocs.length,
    };
  }, [docs, recentDocs]);

  const filteredAndSortedDocs = useMemo(() => {
    let list = [...docs];

    if (project !== null) {
      list = list.filter((doc) => (doc.projectName ?? "") === project);
    }

    if (categoryFilter === "specs") {
      list = list.filter((d) => {
        const t = d.title.toLowerCase();
        return (
          t.includes("spec") ||
          t.includes("prd") ||
          t.includes("rfc") ||
          t.includes("design")
        );
      });
    } else if (categoryFilter === "meetings") {
      list = list.filter((d) => {
        const t = d.title.toLowerCase();
        return (
          t.includes("meeting") ||
          t.includes("sync") ||
          t.includes("notes") ||
          t.includes("retro")
        );
      });
    } else if (categoryFilter === "recent") {
      const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      list = list.filter((d) => d.updatedAt.getTime() > oneWeekAgo);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (doc) =>
          doc.title.toLowerCase().includes(q) ||
          (doc.excerpt && doc.excerpt.toLowerCase().includes(q)) ||
          (doc.projectName && doc.projectName.toLowerCase().includes(q)) ||
          (doc.createdBy && doc.createdBy.toLowerCase().includes(q)),
      );
    }

    list.sort((a, b) =>
      sort === "title"
        ? a.title.localeCompare(b.title)
        : sort === "project"
          ? (a.projectName ?? "~").localeCompare(b.projectName ?? "~")
          : b.updatedAt.getTime() - a.updatedAt.getTime(),
    );

    return list;
  }, [docs, project, categoryFilter, searchQuery, sort]);

  return {
    docs,
    isLoading,
    failed,
    setAttempt,
    sort,
    setSort,
    view,
    setView,
    project,
    setProject,
    searchQuery,
    setSearchQuery,
    categoryFilter,
    setCategoryFilter,
    projectsList,
    recentDocs,
    recentStrip,
    filterCounts,
    filteredAndSortedDocs,
  };
}
