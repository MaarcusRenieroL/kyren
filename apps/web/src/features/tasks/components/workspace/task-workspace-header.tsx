import { ChevronDownIcon } from "lucide-react";
import Link from "next/link";
import type { FC } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@zentro/ui/shadcn/dropdown-menu";
import { ModuleTabs } from "~/src/components/shell/module-section-nav";
import { paths } from "~/src/lib/paths";
import { CreateTaskModal } from "../create-task-modal";
import {
  savedViewLabels,
  groupLabels,
  sortLabels,
  statusNames,
  type TaskGroup,
  type TaskSort,
  type TaskView,
  type SavedView,
  type TaskWorkspaceHeaderProps,
} from "./task-workspace-header/types";
import { FilterBar } from "./task-workspace-header/filter-bar";

export type { TaskGroup, TaskSort, TaskView, SavedView };
export { savedViewLabels, groupLabels, sortLabels, statusNames };

export const TaskWorkspaceHeader: FC<TaskWorkspaceHeaderProps> = ({
  title,
  taskCount,
  totalCount,
  projectScoped = false,
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
  savedView,
  onSavedViewChange,
  compact = false,
  onSearchQueryChange,
  onStatusFilterChange,
  onPriorityFilterChange,
  onAssigneeFilterChange,
  onTeamFilterChange,
  onGroupChange,
  onSortChange,
  onClearFilters,
  onTaskCreated,
}) => {
  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center gap-3">
        {projectScoped ? <p className="eyebrow w-full">Project tasks</p> : null}
        <h1 className="font-display text-[1.75rem] leading-8 sm:text-[length:var(--title-size)] sm:leading-9">
          {title}
        </h1>
        <DropdownMenu>
          <DropdownMenuTrigger className="flex h-8 items-center gap-2 rounded-md border border-hairline px-2.5 text-[13px] outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-ring aria-expanded:bg-hover">
            <span className="font-mono text-[10px] tracking-[0.08em] text-ink-3">
              VIEW
            </span>
            {savedViewLabels[savedView]}
            <ChevronDownIcon className="size-3.5" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48 min-w-48">
            <DropdownMenuRadioGroup
              value={savedView}
              onValueChange={(value) => onSavedViewChange(value as SavedView)}
            >
              {Object.entries(savedViewLabels).map(([value, label]) => (
                <DropdownMenuRadioItem key={value} value={value}>
                  {label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <span className="flex-1" />
        {compact ? null : (
          <Link
            href="/tasks/import"
            className="rounded-lg px-2.5 py-1.5 text-[13px] text-ink-2 outline-none hover:bg-sunken hover:text-ink focus-visible:ring-2 focus-visible:ring-ring"
          >
            Import CSV
          </Link>
        )}
        <CreateTaskModal onTaskCreated={onTaskCreated} />
      </div>

      <ModuleTabs className="mt-4" counts={{ [paths.tasks()]: totalCount }} />

      <FilterBar
        taskCount={taskCount}
        totalCount={totalCount}
        assigneeOptions={assigneeOptions}
        teamOptions={teamOptions}
        filtersActive={filtersActive}
        searchQuery={searchQuery}
        statusFilter={statusFilter}
        priorityFilter={priorityFilter}
        assigneeFilter={assigneeFilter}
        teamFilter={teamFilter}
        group={group}
        sort={sort}
        viewControl={viewControl}
        compact={compact}
        onSearchQueryChange={onSearchQueryChange}
        onStatusFilterChange={onStatusFilterChange}
        onPriorityFilterChange={onPriorityFilterChange}
        onAssigneeFilterChange={onAssigneeFilterChange}
        onTeamFilterChange={onTeamFilterChange}
        onGroupChange={onGroupChange}
        onSortChange={onSortChange}
        onClearFilters={onClearFilters}
      />
    </div>
  );
};
