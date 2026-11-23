"use client";

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useRouter } from "next/navigation";
import type { BulkChange, TaskPriority, TaskStatus, WorkspaceTask } from "~/src/features/tasks/lib/types";
import { paths } from "~/src/lib/paths";

type UseListViewShortcutsParams = {
  visibleTasks: WorkspaceTask[];
  chosen: WorkspaceTask[];
  selected: Set<string>;
  setSelected: Dispatch<SetStateAction<Set<string>>>;
  toggle: (id: string) => void;
  onTasksChange?: (tasks: WorkspaceTask[], change: BulkChange) => void;
  setCreateModalOpen: (open: boolean) => void;
  setShortcutsOpen: Dispatch<SetStateAction<boolean>>;
};

export function useListViewShortcuts({
  visibleTasks,
  chosen,
  selected,
  setSelected,
  toggle,
  onTasksChange,
  setCreateModalOpen,
  setShortcutsOpen,
}: UseListViewShortcutsParams) {
  const router = useRouter();
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const focusedRowRef = useRef<HTMLLIElement | null>(null);

  useEffect(() => {
    if (focusedIndex !== null && focusedRowRef.current) {
      focusedRowRef.current.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [focusedIndex]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable ||
          target.closest("[role='dialog']") ||
          target.closest("[role='menu']"))
      ) {
        return;
      }

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIndex((prev) =>
          prev === null ? 0 : Math.min(visibleTasks.length - 1, prev + 1),
        );
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIndex((prev) =>
          prev === null ? visibleTasks.length - 1 : Math.max(0, prev - 1),
        );
      } else if (e.key === "x") {
        e.preventDefault();
        if (focusedIndex !== null && visibleTasks[focusedIndex]) {
          toggle(visibleTasks[focusedIndex].id);
        }
      } else if (e.key === "A" && e.shiftKey) {
        e.preventDefault();
        setSelected(new Set(visibleTasks.map((t) => t.id)));
      } else if (e.key === "Escape") {
        if (selected.size > 0) {
          setSelected(new Set());
        } else {
          setFocusedIndex(null);
        }
      } else if (e.key === "Enter" || e.key === "o") {
        if (focusedIndex !== null && visibleTasks[focusedIndex]) {
          router.push(paths.task(visibleTasks[focusedIndex].key));
        }
      } else if (e.key === "s" || e.key === "S") {
        const targets =
          chosen.length > 0
            ? chosen
            : focusedIndex !== null && visibleTasks[focusedIndex]
              ? [visibleTasks[focusedIndex]]
              : [];
        if (targets.length > 0 && onTasksChange) {
          e.preventDefault();
          const statusCycle: TaskStatus[] = [
            "todo",
            "in-progress",
            "review",
            "done",
            "backlog",
          ];
          const curr = targets[0]?.status ?? "todo";
          const next =
            statusCycle[(statusCycle.indexOf(curr) + 1) % statusCycle.length] ??
            "todo";
          onTasksChange(targets, { status: next });
        }
      } else if (e.key === "p" || e.key === "P") {
        const targets =
          chosen.length > 0
            ? chosen
            : focusedIndex !== null && visibleTasks[focusedIndex]
              ? [visibleTasks[focusedIndex]]
              : [];
        if (targets.length > 0 && onTasksChange) {
          e.preventDefault();
          const prioCycle: TaskPriority[] = ["low", "medium", "high"];
          const curr = targets[0]?.priority ?? "medium";
          const next =
            prioCycle[(prioCycle.indexOf(curr) + 1) % prioCycle.length] ??
            "medium";
          onTasksChange(targets, { priority: next });
        }
      } else if (e.key === "e" || e.key === "E") {
        const targets =
          chosen.length > 0
            ? chosen
            : focusedIndex !== null && visibleTasks[focusedIndex]
              ? [visibleTasks[focusedIndex]]
              : [];
        if (targets.length > 0 && onTasksChange) {
          e.preventDefault();
          const pointsCycle = [null, 1, 2, 3, 5, 8];
          const curr = targets[0]?.estimatePoints ?? null;
          const currIdx = pointsCycle.indexOf(curr);
          const next = pointsCycle[(currIdx + 1) % pointsCycle.length] ?? null;
          onTasksChange(targets, { estimatePoints: next });
        }
      } else if (e.key === "c" || e.key === "C") {
        e.preventDefault();
        setCreateModalOpen(true);
      } else if (e.key === "?") {
        e.preventDefault();
        setShortcutsOpen((prev) => !prev);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    visibleTasks,
    focusedIndex,
    chosen,
    onTasksChange,
    router,
    selected.size,
    setSelected,
    toggle,
    setCreateModalOpen,
    setShortcutsOpen,
  ]);

  return {
    focusedIndex,
    focusedRowRef,
  };
}
