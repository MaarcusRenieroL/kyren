import Link from "next/link";
import { cn } from "@zentro/ui/lib/utils";
import { paths } from "~/src/lib/paths";
import { formatUpdated, tintFor, type ProjectListItem } from "./types";
import { Contributors, Star, StatusPill } from "./status-pill";

export function Tile({
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
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-hairline/80 bg-surface/80 shadow-2xs transition-all hover:border-signal/40 hover:shadow-xs">
      <header className="flex h-14 items-center gap-2.5 border-b border-hairline/60 bg-muted/20 px-4">
        <span
          className={cn(
            "flex size-[30px] items-center justify-center rounded-lg border border-hairline font-mono text-xs font-semibold",
            tintFor(project.id),
          )}
        >
          {project.name.charAt(0).toUpperCase()}
        </span>
        <StatusPill project={project} />
        <span className="flex-1" />
        <Star project={project} active={favorite} onToggle={onToggleFavorite} />
      </header>
      <div className="flex flex-1 flex-col gap-3.5 p-5">
        <div className="flex flex-col gap-1.5">
          <h3 className="flex items-baseline gap-2 text-[16px] font-semibold text-ink">
            <Link
              href={paths.project(project.slug)}
              className="outline-none after:absolute after:inset-0 after:rounded-2xl focus-visible:after:ring-2 focus-visible:after:ring-ring"
            >
              {project.name}
            </Link>
            <span className="font-mono text-xs font-normal text-ink-3">
              {project.taskKeyPrefix ?? project.slug}
            </span>
          </h3>
          <p className="line-clamp-2 min-h-10 text-[13px] leading-5 text-ink-2">
            {project.description || "No description provided."}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <span
            role="progressbar"
            aria-label={`${done} of ${total} tasks done`}
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted/60"
          >
            <span
              className="block h-full rounded-full bg-status-done transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </span>
          <span className="font-mono text-xs font-medium text-ink-2">
            {done}/{total}
          </span>
        </div>

        <div className="mt-auto flex items-center gap-2 border-t border-hairline/60 pt-3.5 text-xs text-ink-2">
          <span
            aria-hidden="true"
            className="size-2 rounded-full border border-hairline bg-signal/20"
          />
          {project.teamName ?? "Workspace level"}
          <span className="flex-1" />
          <Contributors names={project.contributors ?? []} />
          <span className="font-mono text-[11px] text-ink-3">
            {formatUpdated(project.updatedAt)}
          </span>
        </div>
      </div>
    </article>
  );
}
