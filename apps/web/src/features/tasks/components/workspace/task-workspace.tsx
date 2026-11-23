"use client";

import { useEffect, useState, type FC } from "react";
import { useSidebar } from "@zentro/ui/shadcn/sidebar";
import { CalendarView } from "./calendar-view";
import { EmptyTasks } from "./empty-tasks";
import { ListView } from "./list-view";
import { TaskBoard } from "./task-board";
import {
  TaskWorkspaceHeader,
  type TaskView,
} from "./task-workspace-header";
import { RecurringTasksPanel } from "./recurring-tasks-panel";
import { TemplatesPanel } from "./templates-panel";
import { SprintPanel } from "./sprint-panel";
import type {
  BulkChange,
  TaskStatus,
  WorkspaceTask,
} from "~/src/features/tasks/lib/types";
import { useTaskWorkspaceFilters } from "./task-workspace/use-task-workspace-filters";
import { WorkspaceViewControls } from "./task-workspace/workspace-view-controls";

type Props = {
  title: string;
  tasks: WorkspaceTask[];
  // Only tasks of this project are shown (from /tasks?project=<slug>).
  projectSlug?: string;
  initialStatus?: TaskStatus | "all";
  onTaskStatusChange?: (task: WorkspaceTask, status: TaskStatus) => void;
  onTasksChange?: (tasks: WorkspaceTask[], change: BulkChange) => void;
  onTasksDelete?: (tasks: WorkspaceTask[]) => void;
  onTaskCreated?: () => void | Promise<void>;
};

export const TaskWorkspace: FC<Props> = ({
  title,
  tasks,
  projectSlug,
  initialStatus = "all",
  onTaskStatusChange,
  onTasksChange,
  onTasksDelete,
  onTaskCreated,
}) => {
  const projectId = projectSlug
    ? tasks.find((task) => task.projectSlug === projectSlug)?.projectId
    : undefined;
  const { isMobile } = useSidebar();
  const [chosenView, setView] = useState<TaskView>("list");
  // Phones get the list only; board and calendar need the width.
  const view = isMobile ? "list" : chosenView;

  const {
    savedView,
    setSavedView,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    priorityFilter,
    setPriorityFilter,
    assigneeFilter,
    setAssigneeFilter,
    teamFilter,
    setTeamFilter,
    group,
    setGroup,
    sort,
    setSort,
    sprintScope,
    setSprintScope,
    activeSprintId,
    setActiveSprintId,
    assigneeOptions,
    teamOptions,
    filteredTasks,
    filtersActive,
    currentConfig,
    applyConfig,
    clearFilters,
    filterSummary,
  } = useTaskWorkspaceFilters({
    tasks,
    projectSlug,
    initialStatus,
    chosenView,
    setView,
  });

  const empty =
    tasks.length && (filtersActive || savedView !== "all") ? (
      <EmptyTasks
        filtered={{
          summary: filterSummary.length
            ? filterSummary.join(", ")
            : "in this view",
          total: tasks.length,
          onClear: () => {
            clearFilters();
            setSavedView("all");
          },
        }}
      />
    ) : undefined;

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const activeTag = (document.activeElement?.tagName ?? "").toLowerCase();
      const isInput =
        activeTag === "input" ||
        activeTag === "textarea" ||
        (document.activeElement as HTMLElement)?.isContentEditable;

      if (isInput) return;

      if (e.key === "1") {
        setView("list");
      } else if (e.key === "2" && !isMobile) {
        setView("board");
      } else if (e.key === "3" && !isMobile) {
        setView("calendar");
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMobile]);

  return (
    <section className="flex w-full flex-col">
      <TaskWorkspaceHeader
        title={title}
        taskCount={filteredTasks.length}
        totalCount={tasks.length}
        projectScoped={Boolean(projectSlug)}
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
        view={view}
        savedView={savedView}
        onSavedViewChange={setSavedView}
        compact={isMobile}
        viewControl={
          <WorkspaceViewControls
            currentConfig={currentConfig}
            applyConfig={applyConfig}
            view={view}
            setView={setView}
          />
        }
        onSearchQueryChange={setSearchQuery}
        onStatusFilterChange={setStatusFilter}
        onPriorityFilterChange={setPriorityFilter}
        onAssigneeFilterChange={setAssigneeFilter}
        onTeamFilterChange={setTeamFilter}
        onGroupChange={setGroup}
        onSortChange={setSort}
        onTaskCreated={onTaskCreated}
        onClearFilters={clearFilters}
      />

      {projectId ? (
        <SprintPanel
          projectId={projectId}
          tasks={tasks.filter((task) => task.projectSlug === projectSlug)}
          scope={sprintScope}
          onScopeChange={setSprintScope}
          onActiveSprint={setActiveSprintId}
          onChanged={() => void onTaskCreated?.()}
        />
      ) : null}
      {projectId ? <RecurringTasksPanel projectId={projectId} /> : null}
      {projectId ? (
        <TemplatesPanel
          projectId={projectId}
          onCreated={() => void onTaskCreated?.()}
        />
      ) : null}

      <div className="min-w-0">
        {view === "board" ? (
          <TaskBoard
            tasks={filteredTasks}
            group={group}
            onTaskStatusChange={onTaskStatusChange}
            onTaskCreated={onTaskCreated}
            empty={empty}
          />
        ) : null}
        {view === "list" ? (
          <ListView
            tasks={filteredTasks}
            group={group}
            sort={sort}
            onTasksChange={onTasksChange}
            onTasksDelete={onTasksDelete}
            onTaskCreated={onTaskCreated}
            empty={empty}
          />
        ) : null}
        {view === "calendar" ? <CalendarView tasks={filteredTasks} /> : null}
      </div>
    </section>
  );
};
