"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTrpcClient } from "@kyren/api/react";
import { toastError, toastSuccess } from "@kyren/ui/index";
import type { TaskStatus } from "~/src/features/tasks/lib/types";
import type { LivingSpecTask } from "./types";

type UseLivingSpecParams = {
  docId: string;
  docTitle: string;
  docContent: string;
  projectId?: string | null;
  refreshTrigger?: number;
  onTaskChange?: () => void;
};

export function useLivingSpec({
  docId,
  docTitle,
  docContent,
  projectId,
  refreshTrigger = 0,
  onTaskChange,
}: UseLivingSpecParams) {
  const trpc = useTrpcClient();
  const [tasks, setTasks] = useState<LivingSpecTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "active" | "done">("all");
  const [quickTitle, setQuickTitle] = useState("");
  const [isCreatingQuick, setIsCreatingQuick] = useState(false);
  const [updatingTaskKey, setUpdatingTaskKey] = useState<string | null>(null);

  const loadLinkedTasks = useCallback(async () => {
    try {
      setIsLoading(true);
      const items = await trpc.link.forDoc.query({ docId });
      const taskItems: LivingSpecTask[] = (items ?? [])
        .filter((item) => item.type === "task")
        .map((item) => ({
          linkId: item.linkId,
          id: item.id,
          key: item.key,
          title: item.title,
          status: item.status,
          assignee: item.assignee,
          priority: item.priority ?? "medium",
          estimatePoints: item.estimatePoints ?? null,
          href: item.href,
          relation: item.relation,
        }));
      setTasks(taskItems);
    } catch {
      // Not loaded (no Tasks access, or offline): the panel stays empty.
    } finally {
      setIsLoading(false);
    }
  }, [docId, trpc]);

  useEffect(() => {
    void loadLinkedTasks();
  }, [loadLinkedTasks, refreshTrigger]);

  // Extract checklist items and bullet action items from doc content that are not yet tasks
  const extractedActionItems = useMemo(() => {
    if (!docContent) return [];
    const lines = docContent.split("\n");
    const items: string[] = [];

    for (const rawLine of lines) {
      const line = rawLine.trim();
      // Match markdown checklist: - [ ] item or * [ ] item
      const checkboxMatch = line.match(/^[-*]\s+\[\s*\]\s+(.+)$/i);
      if (checkboxMatch && checkboxMatch[1]) {
        const text = checkboxMatch[1].trim();
        if (text.length > 3 && !items.includes(text)) {
          items.push(text);
        }
      }
    }

    // Filter out items that already have a corresponding linked task
    const existingTitles = new Set(
      tasks.map((t) => t.title.trim().toLowerCase()),
    );
    return items.filter((item) => !existingTitles.has(item.toLowerCase()));
  }, [docContent, tasks]);

  // Metrics
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.status === "done").length;
  const progressPct =
    totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const totalPoints = tasks.reduce(
    (sum, t) =>
      sum + (typeof t.estimatePoints === "number" ? t.estimatePoints : 0),
    0,
  );
  const donePoints = tasks
    .filter((t) => t.status === "done")
    .reduce(
      (sum, t) =>
        sum + (typeof t.estimatePoints === "number" ? t.estimatePoints : 0),
      0,
    );

  const filteredTasks = tasks.filter((task) => {
    if (filter === "active") return task.status !== "done";
    if (filter === "done") return task.status === "done";
    return true;
  });

  const handleStatusChange = async (taskKey: string, newStatus: string) => {
    if (!taskKey) return;
    try {
      setUpdatingTaskKey(taskKey);
      await trpc.task.updateTaskByKey.mutate({
        key: taskKey,
        status: newStatus as TaskStatus,
      });
      // Optimistically update
      setTasks((prev) =>
        prev.map((t) => (t.key === taskKey ? { ...t, status: newStatus } : t)),
      );
      toastSuccess(`Task ${taskKey} marked ${newStatus}`);
      onTaskChange?.();
    } catch (err) {
      toastError(err, "Failed to update task status");
      void loadLinkedTasks();
    } finally {
      setUpdatingTaskKey(null);
    }
  };

  const handleQuickCreate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!quickTitle.trim() || !projectId) return;

    try {
      setIsCreatingQuick(true);
      await trpc.task.createTask.mutate({
        projectId,
        name: quickTitle.trim(),
        description: `Created from spec "${docTitle}"`,
        status: "todo",
        priority: "medium",
        linkDocId: docId,
      });
      setQuickTitle("");
      toastSuccess("Task compiled to spec");
      await loadLinkedTasks();
      onTaskChange?.();
    } catch (err) {
      toastError(err, "Could not create task");
    } finally {
      setIsCreatingQuick(false);
    }
  };

  const handleUnlink = async (linkId: string, taskKey: string | null) => {
    try {
      await trpc.link.remove.mutate({ linkId });
      toastSuccess(`Unlinked ${taskKey ?? "task"} from spec`);
      setTasks((prev) => prev.filter((t) => t.linkId !== linkId));
      onTaskChange?.();
    } catch (err) {
      toastError(err, "Failed to unlink task");
    }
  };

  return {
    isLoading,
    tasks,
    filter,
    setFilter,
    quickTitle,
    setQuickTitle,
    isCreatingQuick,
    updatingTaskKey,
    loadLinkedTasks,
    extractedActionItems,
    totalTasks,
    doneTasks,
    progressPct,
    totalPoints,
    donePoints,
    filteredTasks,
    handleStatusChange,
    handleQuickCreate,
    handleUnlink,
  };
}
