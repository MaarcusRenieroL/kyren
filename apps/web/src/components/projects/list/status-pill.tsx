import { Button } from "@kyren/ui/shadcn/button";
import { StarIcon } from "lucide-react";
import { cn } from "@kyren/ui/lib/utils";
import { ActorAvatar } from "~/src/components/actor-avatar";
import { type ProjectListItem, projectHealth, healthLabel } from "./types";

export function StatusPill({ project }: { project: ProjectListItem }) {
  const health = projectHealth(project);

  return (
    <span
      title={
        health === "risk"
          ? `${project.overdueTasks} overdue ${project.overdueTasks === 1 ? "task" : "tasks"}`
          : undefined
      }
      className={cn(
        "inline-flex h-[22px] w-fit items-center gap-1.5 rounded-sm border bg-tint-chip px-2 text-xs",
        health === "risk"
          ? "border-danger/40 text-danger-text"
          : health === "planning"
            ? "border-dashed border-line-strong text-ink-2"
            : "border-hairline",
      )}
    >
      {health === "risk" ? (
        <span
          aria-hidden="true"
          className="size-1.5 rotate-45 rounded-[1px] bg-current"
        />
      ) : (
        <span
          aria-hidden="true"
          className={cn(
            "size-1.5 rounded-full",
            health === "track" || health === "active"
              ? "bg-status-done"
              : "border border-ink-3",
          )}
        />
      )}
      {healthLabel[health]}
    </span>
  );
}

export function Contributors({ names }: { names: string[] }) {
  if (!names.length) return null;

  return (
    <span className="flex" aria-label={`Working here: ${names.join(", ")}`}>
      {names.map((name, index) => (
        <span
          key={name}
          title={name}
          className={cn(
            "rounded-full ring-2 ring-surface",
            index > 0 && "-ml-1.5",
          )}
        >
          <ActorAvatar name={name} size={22} />
        </span>
      ))}
    </span>
  );
}

export function Star({
  project,
  active,
  onToggle,
}: {
  project: ProjectListItem;
  active: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <Button
      variant="custom"
      type="button"
      aria-pressed={active}
      aria-label={
        active
          ? `Remove ${project.name} from favorites`
          : `Add ${project.name} to favorites`
      }
      onClick={() => onToggle(project.id)}
      className="relative z-[1] flex size-7 items-center justify-center rounded-md text-ink-2 outline-none hover:bg-tint-chip focus-visible:ring-2 focus-visible:ring-ring"
    >
      <StarIcon
        className={cn("size-4", active && "fill-ink text-ink")}
        aria-hidden="true"
      />
    </Button>
  );
}
