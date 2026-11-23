import { useMemo, useState } from "react";
import { useCurrentUserId } from "~/src/components/permissions/permission-provider";
import { statusLabels } from "~/src/features/tasks/lib/constants";
import type {
  TaskPriority,
  TaskStatus,
  WorkspaceTask,
} from "~/src/features/tasks/lib/types";
import {
  savedViewLabels,
  type SavedView,
  type TaskGroup,
  type TaskSort,
  type TaskView,
} from "./../task-workspace-header";
import type { SprintScope } from "./../sprint-panel";
import type { ViewConfig, NewViewConfig } from "./../saved-views-menu";

export function useTaskWorkspaceFilters({
  tasks,
  projectSlug,
  initialStatus,
  chosenView,
  setView,
}: {
  tasks: WorkspaceTask[];
  projectSlug?: string;
  initialStatus: TaskStatus | "all";
  chosenView: TaskView;
  setView: (v: TaskView) => void;
}) {
  const userId = useCurrentUserId();
  const [savedView, setSavedView] = useState<SavedView>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">(
    initialStatus,
  );
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | "all">(
    "all",
  );
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [teamFilter, setTeamFilter] = useState("all");
  const [group, setGroup] = useState<TaskGroup>("state");
  const [sort, setSort] = useState<TaskSort>("due");
  const [sprintScope, setSprintScope] = useState<SprintScope>("all");
  const [activeSprintId, setActiveSprintId] = useState<string | null>(null);

  const assigneeOptions = useMemo(() => {
    return Array.from(new Set(tasks.map((task) => task.assignee))).sort(
      (a, b) => a.localeCompare(b),
    );
  }, [tasks]);

  const teamOptions = useMemo(() => {
    const options = new Map<string, string>();
    tasks.forEach((task) => {
      if (task.teamId && task.teamName) {
        options.set(task.teamId, task.teamName);
      }
    });
    return Array.from(options, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    const weekEnd = new Date();
    weekEnd.setHours(23, 59, 59, 999);
    weekEnd.setDate(weekEnd.getDate() + ((7 - weekEnd.getDay()) % 7));

    return tasks.filter((task) => {
      const matchesView =
        savedView === "all" ||
        (savedView === "mine"
          ? task.assigneeUserId === userId && task.status !== "done"
          : task.status !== "done" &&
            Boolean(task.dueAt) &&
            new Date(task.dueAt!).getTime() <= weekEnd.getTime());
      const matchesProject = !projectSlug || task.projectSlug === projectSlug;
      const matchesSearch =
        !normalizedSearch ||
        [
          task.key,
          task.title,
          task.description,
          task.projectName,
          task.teamName ?? "",
          task.assignee,
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch);
      const matchesStatus =
        statusFilter === "all" || task.status === statusFilter;
      const matchesPriority =
        priorityFilter === "all" || task.priority === priorityFilter;
      const matchesAssignee =
        assigneeFilter === "all" || task.assignee === assigneeFilter;
      const matchesTeam =
        teamFilter === "all" ||
        (teamFilter === "workspace" && !task.teamId) ||
        task.teamId === teamFilter;
      const matchesScope =
        sprintScope === "all" ||
        (sprintScope === "sprint"
          ? Boolean(activeSprintId) && task.sprintId === activeSprintId
          : !task.sprintId);

      return (
        matchesView &&
        matchesProject &&
        matchesSearch &&
        matchesStatus &&
        matchesPriority &&
        matchesAssignee &&
        matchesTeam &&
        matchesScope
      );
    });
  }, [
    savedView,
    userId,
    assigneeFilter,
    priorityFilter,
    projectSlug,
    searchQuery,
    sprintScope,
    activeSprintId,
    statusFilter,
    tasks,
    teamFilter,
  ]);

  const filtersActive =
    Boolean(searchQuery.trim()) ||
    statusFilter !== "all" ||
    priorityFilter !== "all" ||
    assigneeFilter !== "all" ||
    teamFilter !== "all" ||
    sprintScope !== "all";

  const currentConfig: NewViewConfig = {
    search: searchQuery.trim(),
    status: statusFilter,
    priority: priorityFilter,
    assignee: assigneeFilter,
    team: teamFilter,
    group,
    sort,
    view: chosenView,
  };

  const applyConfig = (config: ViewConfig) => {
    setSearchQuery(config.search);
    setStatusFilter(config.status as TaskStatus | "all");
    setPriorityFilter(config.priority as TaskPriority | "all");
    setAssigneeFilter(config.assignee);
    setTeamFilter(config.team);
    setGroup(config.group as TaskGroup);
    setSort(config.sort as TaskSort);
    setView(config.view as TaskView);
    setSavedView("all");
  };

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setPriorityFilter("all");
    setAssigneeFilter("all");
    setTeamFilter("all");
    setSprintScope("all");
  };

  const filterSummary = [
    statusFilter !== "all" ? statusLabels[statusFilter].toLowerCase() : null,
    assigneeFilter !== "all" ? `assigned to ${assigneeFilter}` : null,
    teamFilter !== "all"
      ? teamFilter === "workspace"
        ? "outside a team"
        : `on the ${teamOptions.find((team) => team.id === teamFilter)?.name ?? "chosen"} team`
      : null,
    priorityFilter !== "all" ? `${priorityFilter} priority` : null,
    searchQuery.trim() ? `matching “${searchQuery.trim()}”` : null,
    savedView !== "all" ? `in ${savedViewLabels[savedView]}` : null,
  ].filter(Boolean);

  return {
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
  };
}
