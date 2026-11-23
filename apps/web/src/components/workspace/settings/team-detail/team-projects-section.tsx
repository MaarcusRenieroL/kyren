import Link from "next/link";
import { paths } from "~/src/lib/paths";
import type { TeamDetailData } from "./types";

export function TeamProjectsSection({
  projects,
}: {
  projects: TeamDetailData["projects"];
}) {
  return (
    <section aria-labelledby="team-projects" className="flex flex-col">
      <h2
        id="team-projects"
        className="flex items-center gap-2 pb-2 font-semibold"
      >
        Projects
        <span className="font-mono text-xs font-normal text-ink-3">
          {projects.length}
        </span>
      </h2>
      {projects.length ? (
        projects.map((project) => {
          const total = project.totalTasks ?? 0;
          const finished = project.doneTasks ?? 0;

          return (
            <Link
              key={project.id}
              href={paths.project(project.slug)}
              className="flex items-center gap-3 border-b border-hairline/60 px-1 py-2.5 hover:bg-hover"
            >
              <span
                aria-hidden="true"
                className="flex size-6 items-center justify-center rounded-sm border border-hairline bg-tint-projects font-mono text-[11px]"
              >
                {project.name.charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0 truncate text-[15px]">
                {project.name}
              </span>
              <span className="font-mono text-[11px] text-ink-3">
                {project.taskKeyPrefix}
              </span>
              <span className="flex-1" />
              <span className="hidden h-1.5 w-28 overflow-hidden rounded-full bg-sunken sm:block">
                <span
                  className="block h-full rounded-full bg-success"
                  style={{
                    width: `${total ? Math.round((finished / total) * 100) : 0}%`,
                  }}
                />
              </span>
              <span className="w-14 text-right font-mono text-xs text-ink-2">
                {finished}/{total}
              </span>
            </Link>
          );
        })
      ) : (
        <p className="py-3 text-sm text-ink-2">
          No projects belong to this team yet.
        </p>
      )}
    </section>
  );
}
