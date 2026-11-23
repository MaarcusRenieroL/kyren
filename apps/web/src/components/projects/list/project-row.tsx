import Link from "next/link";
import { FolderKanbanIcon } from "lucide-react";
import { cn } from "@kyren/ui/lib/utils";
import { paths } from "~/src/lib/paths";
import { formatUpdated, tintFor, type ProjectListItem } from "./types";
import { Star, StatusPill } from "./status-pill";

export function Row({
  project,
  favorite,
  onToggleFavorite,
}: {
  project: ProjectListItem;
  favorite: boolean;
  onToggleFavorite: (id: string) => void;
}) {
  const total = project.totalTasks ?? 0;
  const done = project.doneTasks ?? 0;

  return (
    <li className="relative flex min-h-16 items-center gap-3 rounded-xl border-t border-hairline/60 px-3 py-2 first:border-t-0 hover:bg-hover">
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg text-ink",
          tintFor(project.id),
        )}
      >
        <FolderKanbanIcon className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <Link
          href={paths.project(project.slug)}
          className="block truncate text-[15px] font-medium outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-ring"
        >
          {project.name}
        </Link>
        <p className="truncate font-mono text-xs text-ink-3">
          {project.taskKeyPrefix ?? project.slug}
          <span className="hidden sm:inline">
            {" · "}
            {project.description || "No description provided."}
          </span>
        </p>
      </div>
      <span className="hidden w-24 shrink-0 font-mono text-xs text-ink-2 md:block">
        {done}/{total} done
      </span>
      <StatusPill project={project} />
      <span className="hidden w-32 truncate text-xs text-ink-2 lg:block">
        {project.teamName ?? "Workspace level"}
      </span>
      <span className="hidden w-20 text-right font-mono text-xs text-ink-3 sm:block">
        {formatUpdated(project.updatedAt)}
      </span>
      <Star project={project} active={favorite} onToggle={onToggleFavorite} />
    </li>
  );
}
