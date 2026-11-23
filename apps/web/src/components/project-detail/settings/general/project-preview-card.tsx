import type { FC } from "react";
import { cn } from "@zentro/ui/index";
import type { ProjectGeneralSectionFormValues } from "~/src/lib/zod-schema";
import { formatDate, type ProjectData, type TeamOption } from "./types";

export const ProjectPreviewCard: FC<{
  project: ProjectData;
  preview: ProjectGeneralSectionFormValues;
  previewTeam?: TeamOption;
}> = ({ project, preview, previewTeam }) => {
  return (
    <aside className="flex flex-col gap-3">
      <span className="eyebrow">Preview</span>
      <div className="tile overflow-hidden">
        <div className="flex h-14 items-center gap-2.5 bg-tint-projects px-3.5">
          <span className="flex size-[30px] items-center justify-center rounded-sm border border-hairline bg-tint-chip font-mono text-xs">
            {(preview.name || "?").charAt(0).toUpperCase()}
          </span>
          <span className="inline-flex h-[22px] items-center gap-1.5 rounded-sm border border-hairline bg-tint-chip px-2 text-xs">
            <span
              aria-hidden="true"
              className={cn(
                "size-1.5 rounded-full",
                project.status === "archived"
                  ? "border border-ink-3"
                  : "bg-status-done",
              )}
            />
            {project.status === "archived" ? "Archived" : "Active"}
          </span>
        </div>
        <div className="flex flex-col gap-1.5 px-4 pt-3.5 pb-4">
          <h3 className="flex items-baseline gap-2 text-base font-semibold">
            <span className="truncate">
              {preview.name || "Untitled project"}
            </span>
            <span className="font-mono text-xs font-normal text-ink-3">
              {project.taskKeyPrefix ?? preview.slug}
            </span>
          </h3>
          <p className="line-clamp-3 text-[13px] leading-5 text-ink-2">
            {preview.description || "No description provided."}
          </p>
          <p className="flex items-center gap-2 pt-1 text-[13px] text-ink-2">
            <span
              aria-hidden="true"
              className="size-2 rounded-[3px] border border-hairline bg-tint-teams"
            />
            {previewTeam?.name ??
              (preview.teamId ? project.teamName : null) ??
              "Workspace level"}
          </p>
        </div>
      </div>
      <p className="text-[13px] text-ink-3">
        How the project appears on the projects list. Created{" "}
        {formatDate(project.createdAt)} by {project.owner}.
      </p>
    </aside>
  );
};
