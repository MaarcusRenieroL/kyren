"use client";

import { useState, type FormEvent, type FC } from "react";
import Link from "next/link";
import {
  SearchIcon,
  FileTextIcon,
  TicketIcon,
  CheckCircle2Icon,
  Loader2Icon,
} from "lucide-react";
import { useTrpcClient } from "@zentro/api/react";
import { Button } from "@zentro/ui/shadcn/button";
import { Input } from "@zentro/ui/shadcn/input";
import { TabsContent } from "@zentro/ui/shadcn/tabs";
import { toastError } from "@zentro/ui/index";
import type { SearchHit } from "./types";

export const SearchTab: FC<{
  onClose: () => void;
}> = ({ onClose }) => {
  const trpc = useTrpcClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchHit[]>([]);

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    try {
      const hits = await trpc.ai.semanticSearch.query({
        query: searchQuery.trim(),
        limit: 8,
      });
      setSearchResults(hits);
    } catch (err) {
      toastError(err, "Search failed.");
    } finally {
      setSearchLoading(false);
    }
  }

  return (
    <TabsContent
      value="search"
      className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 m-0"
    >
      <form onSubmit={handleSearch} className="flex gap-2">
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Ask or search tasks, docs, tickets..."
          className="text-xs"
        />
        <Button
          size="sm"
          type="submit"
          disabled={searchLoading || !searchQuery.trim()}
        >
          {searchLoading ? (
            <Loader2Icon className="size-3.5 animate-spin" />
          ) : (
            <SearchIcon className="size-3.5" />
          )}
        </Button>
      </form>

      <div className="flex flex-col gap-2 flex-1">
        {searchResults.length === 0 && !searchLoading ? (
          <div className="flex flex-col items-center justify-center p-8 text-center text-ink-3">
            <SearchIcon className="size-8 opacity-30 mb-2" />
            <p className="text-xs">
              Type a keyword or question to search with tenant-isolated hybrid
              matching.
            </p>
          </div>
        ) : (
          searchResults.map((hit) => (
            <Link
              key={`${hit.type}-${hit.id}`}
              href={hit.href}
              onClick={onClose}
              className="group flex flex-col gap-1 rounded-lg border border-hairline p-2.5 transition-colors hover:bg-hover"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {hit.type === "task" ? (
                    <CheckCircle2Icon className="size-3.5 text-signal" />
                  ) : hit.type === "doc" ? (
                    <FileTextIcon className="size-3.5 text-tint-teams" />
                  ) : (
                    <TicketIcon className="size-3.5 text-tint-sun" />
                  )}
                  <span className="font-mono text-[11px] font-semibold text-ink-2">
                    {hit.key}
                  </span>
                </div>
                <span className="text-[10px] text-ink-3 uppercase">
                  {hit.type}
                </span>
              </div>
              <p className="text-xs font-medium text-ink group-hover:underline">
                {hit.title}
              </p>
              {hit.snippet ? (
                <p className="line-clamp-2 text-[11px] text-ink-3">
                  {hit.snippet}
                </p>
              ) : null}
            </Link>
          ))
        )}
      </div>
    </TabsContent>
  );
};
