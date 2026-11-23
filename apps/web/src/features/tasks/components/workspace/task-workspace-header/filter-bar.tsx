import { Input } from "@kyren/ui/shadcn/input";
import { Button } from "@kyren/ui/shadcn/button";
import { ArrowDownUpIcon, LayersIcon, SearchIcon } from "lucide-react";
import { cn } from "@kyren/ui/lib/utils";
import { SelectItem } from "@kyren/ui/shadcn/select";
import type { TaskPriority, TaskStatus } from "~/src/features/tasks/lib/types";
import { FilterChip } from "./filter-chip";
import {
  allValue,
  groupLabels,
  sortLabels,
  statusNames,
  type TaskWorkspaceHeaderProps,
  type TaskGroup,
  type TaskSort,
} from "./types";

export function FilterBar({
  taskCount,
  totalCount,
  assigneeOptions,
  teamOptions,
  filtersActive,
  searchQuery,
  statusFilter,
  priorityFilter,
  assigneeFilter,
  teamFilter,
  group,
  sort,
  viewControl,
  compact = false,
  onSearchQueryChange,
  onStatusFilterChange,
  onPriorityFilterChange,
  onAssigneeFilterChange,
  onTeamFilterChange,
  onGroupChange,
  onSortChange,
  onClearFilters,
}: Omit<
  TaskWorkspaceHeaderProps,
  | "title"
  | "projectScoped"
  | "savedView"
  | "onSavedViewChange"
  | "onTaskCreated"
  | "view"
>) {
  const teamName =
    teamFilter === "all"
      ? "All"
      : teamFilter === "workspace"
        ? "Workspace"
        : (teamOptions.find((team) => team.id === teamFilter)?.name ?? "All");

  return (
    <div
      className={cn(
        "mt-3.5 mb-3 flex items-center gap-2",
        compact ? "tab-scroll -mx-4 px-4" : "flex-wrap",
      )}
    >
      <div
        className={cn(
          "relative h-8 min-w-0 shrink-0",
          compact ? "w-[200px]" : "w-60",
        )}
      >
        <SearchIcon
          aria-hidden="true"
          className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-ink-3"
        />
        <Input
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          placeholder="Filter by title or key"
          aria-label="Filter tasks"
          className="h-full w-full rounded-xl border border-hairline bg-surface pr-2.5 pl-8 text-[13px] outline-none placeholder:text-ink-3 focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/22"
        />
      </div>

      <FilterChip
        label="Status"
        active={statusFilter !== "all"}
        value={statusFilter}
        display={statusFilter === "all" ? "All" : statusNames[statusFilter]!}
        onValueChange={(value) =>
          onStatusFilterChange(value as TaskStatus | "all")
        }
      >
        <SelectItem value="all">All statuses</SelectItem>
        {Object.entries(statusNames).map(([value, label]) => (
          <SelectItem key={value} value={value}>
            {label}
          </SelectItem>
        ))}
      </FilterChip>

      <FilterChip
        label="Priority"
        active={priorityFilter !== "all"}
        value={priorityFilter}
        display={
          priorityFilter === "all"
            ? "All"
            : priorityFilter.charAt(0).toUpperCase() + priorityFilter.slice(1)
        }
        onValueChange={(value) =>
          onPriorityFilterChange(value as TaskPriority | "all")
        }
      >
        <SelectItem value="all">All priorities</SelectItem>
        <SelectItem value="low">Low</SelectItem>
        <SelectItem value="medium">Medium</SelectItem>
        <SelectItem value="high">High</SelectItem>
      </FilterChip>

      <FilterChip
        label="Assignee"
        active={assigneeFilter !== "all"}
        value={assigneeFilter === "all" ? allValue : assigneeFilter}
        display={assigneeFilter === "all" ? "All" : assigneeFilter}
        onValueChange={(value) =>
          onAssigneeFilterChange(value === allValue ? "all" : value)
        }
      >
        <SelectItem value={allValue}>All assignees</SelectItem>
        {assigneeOptions.map((assignee) => (
          <SelectItem key={assignee} value={assignee}>
            {assignee}
          </SelectItem>
        ))}
      </FilterChip>

      <FilterChip
        label="Team"
        active={teamFilter !== "all"}
        value={teamFilter}
        display={teamName}
        onValueChange={onTeamFilterChange}
      >
        <SelectItem value="all">All teams</SelectItem>
        <SelectItem value="workspace">Workspace level</SelectItem>
        {teamOptions.map((team) => (
          <SelectItem key={team.id} value={team.id}>
            {team.name}
          </SelectItem>
        ))}
      </FilterChip>

      {filtersActive ? (
        <Button
          variant="custom"
          type="button"
          onClick={onClearFilters}
          className="h-8 rounded-xl px-2 text-[13px] text-ink-2 outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-ring"
        >
          Clear
        </Button>
      ) : null}
      <span className="shrink-0 font-mono text-xs whitespace-nowrap text-ink-3">
        {filtersActive && taskCount !== totalCount
          ? `${taskCount} of ${totalCount}`
          : `${taskCount} ${taskCount === 1 ? "task" : "tasks"}`}
      </span>

      <span className="flex-1" />
      {compact ? null : (
        <>
          <FilterChip
            label="Group"
            icon={<LayersIcon className="size-3.5" aria-hidden="true" />}
            showValue
            active={false}
            value={group}
            display={groupLabels[group]}
            onValueChange={(value) => onGroupChange(value as TaskGroup)}
          >
            {Object.entries(groupLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </FilterChip>

          <FilterChip
            label="Sort"
            icon={<ArrowDownUpIcon className="size-3.5" aria-hidden="true" />}
            showValue
            active={false}
            value={sort}
            display={sortLabels[sort]}
            onValueChange={(value) => onSortChange(value as TaskSort)}
          >
            {Object.entries(sortLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </FilterChip>

          {viewControl}
        </>
      )}
    </div>
  );
}
