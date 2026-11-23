"use client";

import { Skeleton } from "@zentro/ui/shadcn/skeleton";
import {
  type ProjectListItem,
  type ProjectListProps,
  projectHealth,
} from "./list/types";
import { StatusPill } from "./list/status-pill";
import { Tile } from "./list/project-tile";
import { Row } from "./list/project-row";

export type { ProjectListItem };
export { projectHealth, StatusPill };

export const ProjectList = ({
  isLoading,
  projects,
  view,
  hasFilters,
  favoriteIds,
  onToggleFavorite,
  groupLabel,
}: ProjectListProps) => {
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="tile overflow-hidden">
            <Skeleton className="h-[52px] rounded-none" />
            <div className="flex flex-col gap-3 p-[18px]">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-1 w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line-strong px-6 py-16 text-center">
        <p className="font-display font-semibold text-xl tracking-tight text-balance text-ink">
          {hasFilters ? "No projects match these filters." : "No projects yet."}
        </p>
        <p className="max-w-[460px] text-[15px] text-ink-2">
          {hasFilters
            ? "Try a different name, team or the Favorites filter."
            : "A project groups tasks and docs under one key, like ZEN. Tasks you create inside it are numbered ZEN-1, ZEN-2 and so on."}
        </p>
        {hasFilters ? null : (
          <p className="text-[13px] text-ink-3">Use New project above.</p>
        )}
      </div>
    );
  }

  const favorites = projects.filter((project) =>
    favoriteIds.includes(project.id),
  );
  const rest = projects.filter((project) => !favoriteIds.includes(project.id));
  const render = (items: ProjectListItem[]) =>
    view === "list" ? (
      <ul aria-label="Projects" className="flex flex-col">
        {items.map((project) => (
          <Row
            key={project.id}
            project={project}
            favorite={favoriteIds.includes(project.id)}
            onToggleFavorite={onToggleFavorite}
          />
        ))}
      </ul>
    ) : (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((project) => (
          <Tile
            key={project.id}
            project={project}
            favorite={favoriteIds.includes(project.id)}
            onToggleFavorite={onToggleFavorite}
          />
        ))}
      </div>
    );

  return (
    <div className="flex flex-col gap-7">
      {favorites.length > 0 ? (
        <section aria-label="Favorites" className="flex flex-col gap-3">
          <h2 className="eyebrow">Favorites</h2>
          {render(favorites)}
        </section>
      ) : null}
      {rest.length > 0 ? (
        <section aria-label={groupLabel} className="flex flex-col gap-3">
          {favorites.length > 0 ? (
            <h2 className="eyebrow">{groupLabel}</h2>
          ) : null}
          {render(rest)}
        </section>
      ) : null}
    </div>
  );
};
