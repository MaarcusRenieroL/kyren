import { cn } from "@zentro/ui/lib/utils";
import { getDocProject, type DocsListItem } from "../lib/docs";

const projectTints = [
  "bg-tint-tasks",
  "bg-tint-projects",
  "bg-tint-docs",
  "bg-tint-teams",
  "bg-tint-audit",
] as const;

export function tintFor(seed: string) {
  let hash = 0;

  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;

  return projectTints[hash % projectTints.length];
}

/** The project as a small tinted mono chip, or "No project". */
export function ProjectChip({ doc }: { doc: DocsListItem }) {
  if (!doc.projectName) {
    return (
      <span className="inline-flex items-center gap-1 rounded-sm border border-hairline/60 bg-muted/40 px-1.5 py-0.5 font-mono text-[10px] text-ink-3">
        Workspace
      </span>
    );
  }

  return (
    <span
      title={doc.projectName}
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-sm border border-hairline px-1.5 py-0.5 font-mono text-[10px] text-ink font-medium shadow-2xs",
        tintFor(doc.projectName),
      )}
    >
      <span className="size-1.5 rounded-full bg-ink/60" />
      <span className="truncate">{doc.projectKey ?? getDocProject(doc)}</span>
    </span>
  );
}
