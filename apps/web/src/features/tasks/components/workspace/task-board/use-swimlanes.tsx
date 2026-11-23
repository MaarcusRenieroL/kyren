import { useMemo } from "react";
import { UserIcon } from "lucide-react";
import { PriorityGlyph } from "@kyren/ui/components/status-glyph";
import { ActorAvatar } from "~/src/components/actor-avatar";
import type { WorkspaceTask } from "~/src/features/tasks/lib/types";
import type { TaskGroup } from "./../task-workspace-header";
import type { Swimlane } from "./types";

export function useSwimlanes(
  tasks: WorkspaceTask[],
  group: TaskGroup,
  isSwimlaneMode: boolean,
): Swimlane[] {
  return useMemo(() => {
    if (!isSwimlaneMode) return [];

    if (group === "assignee") {
      const map = new Map<string, WorkspaceTask[]>();
      const unassignedTasks: WorkspaceTask[] = [];

      for (const t of tasks) {
        if (!t.assignee || t.assignee.toLowerCase() === "unassigned") {
          unassignedTasks.push(t);
        } else {
          const list = map.get(t.assignee) ?? [];
          list.push(t);
          map.set(t.assignee, list);
        }
      }

      const lanes: Swimlane[] = [];
      const sortedAssignees = Array.from(map.keys()).sort((a, b) =>
        a.localeCompare(b),
      );

      for (const assignee of sortedAssignees) {
        const laneTasks = map.get(assignee) ?? [];
        lanes.push({
          id: `assignee-${assignee}`,
          title: assignee,
          icon: <ActorAvatar name={assignee} size={20} />,
          tasks: laneTasks,
          totalPoints: laneTasks.reduce(
            (acc, t) => acc + (t.estimatePoints ?? 0),
            0,
          ),
        });
      }

      if (unassignedTasks.length > 0) {
        lanes.push({
          id: "assignee-unassigned",
          title: "Unassigned",
          icon: (
            <div className="flex size-5 items-center justify-center rounded-full bg-surface-subtle border border-hairline text-ink-3">
              <UserIcon className="size-3" />
            </div>
          ),
          tasks: unassignedTasks,
          totalPoints: unassignedTasks.reduce(
            (acc, t) => acc + (t.estimatePoints ?? 0),
            0,
          ),
        });
      }

      return lanes;
    }

    if (group === "priority") {
      const priorities: Array<{
        id: "high" | "medium" | "low";
        label: string;
      }> = [
        { id: "high", label: "Urgent / High" },
        { id: "medium", label: "Medium Priority" },
        { id: "low", label: "Low Priority" },
      ];

      return priorities.map(({ id, label }) => {
        const laneTasks = tasks.filter((t) => t.priority === id);
        return {
          id: `priority-${id}`,
          title: label,
          icon: <PriorityGlyph priority={id} size={15} decorative />,
          tasks: laneTasks,
          totalPoints: laneTasks.reduce(
            (acc, t) => acc + (t.estimatePoints ?? 0),
            0,
          ),
        };
      });
    }

    if (group === "project") {
      const map = new Map<string, WorkspaceTask[]>();
      for (const t of tasks) {
        const projName = t.projectName || "General";
        const list = map.get(projName) ?? [];
        list.push(t);
        map.set(projName, list);
      }

      const lanes: Swimlane[] = [];
      const sortedProjects = Array.from(map.keys()).sort((a, b) =>
        a.localeCompare(b),
      );

      for (const proj of sortedProjects) {
        const laneTasks = map.get(proj) ?? [];
        lanes.push({
          id: `project-${proj}`,
          title: proj,
          icon: (
            <span className="flex size-5 items-center justify-center rounded bg-tint-projects font-mono text-[9px] font-semibold text-ink">
              {proj.charAt(0).toUpperCase()}
            </span>
          ),
          tasks: laneTasks,
          totalPoints: laneTasks.reduce(
            (acc, t) => acc + (t.estimatePoints ?? 0),
            0,
          ),
        });
      }

      return lanes;
    }

    return [];
  }, [group, isSwimlaneMode, tasks]);
}
