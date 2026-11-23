"use client";

import type { FC } from "react";
import { SparklesIcon } from "lucide-react";
import { ErrorState } from "@zentro/ui/components/error-state";
import { Skeleton } from "@zentro/ui/shadcn/skeleton";
import { Button } from "@zentro/ui/shadcn/button";
import { ModuleNavClaim } from "~/src/components/shell/module-section-nav";
import { DocTable, DocTiles, DocGrouped } from "../../doc-rows";
import { CreateDocModal } from "./create-doc-modal";
import { Header } from "./header";
import { TemplateRow } from "./templates";
import { SearchToolbar } from "./search-toolbar";
import { useDashboardDocs } from "./dashboard-filters";
import { DashboardCollectionHeader } from "./dashboard-collection-header";

export const HomeDashboard: FC = () => {
  const {
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
  } = useDashboardDocs();

  return (
    <div className="w-full flex min-w-0 flex-col gap-10 sm:gap-12">
      <ModuleNavClaim />
      <Header
        totalDocs={docs.length}
        projectCount={projectsList.length}
        recentCount={recentDocs.length}
      />

      <SearchToolbar
        query={searchQuery}
        onQueryChange={setSearchQuery}
        activeFilter={categoryFilter}
        onFilterChange={setCategoryFilter}
        filterCounts={filterCounts}
        projects={projectsList}
        selectedProject={project}
        onProjectChange={setProject}
      />

      {failed ? (
        <ErrorState
          title="Docs could not be loaded"
          message="We could not read your docs. They are safe; try again."
          onRetry={() => setAttempt((value) => value + 1)}
        />
      ) : isLoading ? (
        <div className="flex flex-col gap-6" aria-busy="true">
          <Skeleton className="h-5 w-32 rounded-lg" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[0, 1, 2, 3].map((tile) => (
              <Skeleton key={tile} className="h-[160px] rounded-2xl" />
            ))}
          </div>
          {[0, 1, 2, 3].map((row) => (
            <Skeleton key={row} className="h-12 rounded-2xl" />
          ))}
        </div>
      ) : docs.length === 0 ? (
        <>
          <div className="flex flex-col items-center gap-4 rounded-3xl border border-dashed border-hairline/80 bg-surface/50 px-8 py-20 text-center shadow-xs">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-tint-docs text-ink shadow-sm">
              <SparklesIcon className="size-7" />
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-ink">
              Your Knowledge Base is Empty
            </h2>
            <p className="max-w-[500px] text-sm text-ink-3 leading-relaxed">
              Specs, meeting notes, and architectural decisions live here, next
              to the tasks they explain. Start blank or pick a blueprint below.
            </p>
            <div className="pt-2">
              <CreateDocModal triggerVariant="outline" />
            </div>
          </div>
          <TemplateRow />
        </>
      ) : (
        <>
          {/* Quick Start Blueprints */}
          <TemplateRow />

          {/* Recent Strip (only shown when not searching and on All filter) */}
          {!searchQuery &&
            categoryFilter === "all" &&
            project === null &&
            recentStrip.length > 0 && (
              <section aria-label="Recent docs" className="flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-3">
                    Recently Edited
                  </h2>
                </div>
                <DocTiles
                  docs={recentStrip}
                  columns="sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                />
              </section>
            )}

          {/* Document Collection View */}
          <section aria-label="All docs" className="flex flex-col gap-5">
            <DashboardCollectionHeader
              project={project}
              categoryFilter={categoryFilter}
              totalCount={filteredAndSortedDocs.length}
              sort={sort}
              setSort={setSort}
              view={view}
              setView={setView}
            />

            {/* Render Selected View */}
            {filteredAndSortedDocs.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-hairline py-12 text-center">
                <p className="text-sm font-medium text-ink">
                  No documents match your search or filter
                </p>
                <p className="mt-1 text-xs text-ink-3">
                  Try clearing the search query or switching categories.
                </p>
                <Button
                  variant="outline"
                  size="xs"
                  className="mt-3 text-xs"
                  onClick={() => {
                    setSearchQuery("");
                    setCategoryFilter("all");
                    setProject(null);
                  }}
                >
                  Reset all filters
                </Button>
              </div>
            ) : view === "table" ? (
              <DocTable docs={filteredAndSortedDocs} />
            ) : view === "grouped" ? (
              <DocGrouped docs={filteredAndSortedDocs} />
            ) : (
              <DocTiles
                docs={filteredAndSortedDocs}
                columns="sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
              />
            )}
          </section>
        </>
      )}
    </div>
  );
};
