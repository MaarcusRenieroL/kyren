"use client";

import {
  PlusIcon,
  ListTodoIcon,
  LayersIcon,
  RefreshCwIcon,
} from "lucide-react";
import { Button } from "@zentro/ui/shadcn/button";
import { Input } from "@zentro/ui/shadcn/input";
import { cn } from "@zentro/ui/lib/utils";
import type { LivingSpecTask } from "./living-spec/types";
import { LivingSpecItem } from "./living-spec/living-spec-item";
import { ActionItemsCompiler } from "./living-spec/action-items-compiler";
import { useLivingSpec } from "./living-spec/use-living-spec";

export type { LivingSpecTask };

interface LivingSpecPanelProps {
  docId: string;
  docTitle: string;
  docContent: string;
  projectId?: string | null;
  canEdit: boolean;
  canCreateTask: boolean;
  refreshTrigger?: number;
  onOpenCreateTask: (prefillName?: string) => void;
  onTaskChange?: () => void;
}

export function LivingSpecPanel({
  docId,
  docTitle,
  docContent,
  projectId,
  canEdit,
  canCreateTask,
  refreshTrigger = 0,
  onOpenCreateTask,
  onTaskChange,
}: LivingSpecPanelProps) {
  const {
    isLoading,
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
  } = useLivingSpec({
    docId,
    docTitle,
    docContent,
    projectId,
    refreshTrigger,
    onTaskChange,
  });

  return (
    <div className="flex flex-col h-full bg-surface border-l border-hairline overflow-hidden select-none">
      {/* Top Header */}
      <div className="p-4 border-b border-hairline bg-surface/50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-signal/10 text-signal">
              <LayersIcon className="size-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-ink leading-tight">
                Living Spec Tasks
              </h3>
              <p className="text-[11px] text-ink-3">
                Live synchronization between Doc & Execution
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => void loadLinkedTasks()}
              title="Refresh tasks"
              className="text-ink-3 hover:text-ink"
            >
              <RefreshCwIcon
                className={cn("size-3.5", isLoading && "animate-spin")}
              />
            </Button>
            {canCreateTask && (
              <Button
                size="xs"
                variant="outline"
                className="gap-1 border-hairline text-xs h-7"
                onClick={() => onOpenCreateTask()}
              >
                <PlusIcon className="size-3" />
                Add
              </Button>
            )}
          </div>
        </div>

        {/* Progress & Spec Completion Gauge */}
        <div className="rounded-lg border border-hairline bg-background/60 p-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-ink-2">
              Implementation Progress
            </span>
            <span className="font-mono font-semibold text-signal">
              {progressPct}% ({doneTasks}/{totalTasks})
            </span>
          </div>
          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-signal transition-all duration-500 rounded-full"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          {totalPoints > 0 && (
            <div className="flex items-center justify-between text-[11px] text-ink-3 pt-0.5">
              <span>Story Points Rollup:</span>
              <span className="font-mono font-medium">
                {donePoints} / {totalPoints} pts done
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Action Items Compiler Banner */}
      {canCreateTask && (
        <ActionItemsCompiler
          extractedActionItems={extractedActionItems}
          onOpenCreateTask={onOpenCreateTask}
        />
      )}

      {/* Filter Tabs */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-hairline bg-surface/30 text-xs">
        <div className="flex gap-1">
          <Button
            variant="custom"
            type="button"
            onClick={() => setFilter("all")}
            className={cn(
              "px-2 py-0.5 rounded text-xs transition-colors",
              filter === "all"
                ? "bg-muted font-medium text-ink"
                : "text-ink-3 hover:text-ink",
            )}
          >
            All ({totalTasks})
          </Button>
          <Button
            variant="custom"
            type="button"
            onClick={() => setFilter("active")}
            className={cn(
              "px-2 py-0.5 rounded text-xs transition-colors",
              filter === "active"
                ? "bg-muted font-medium text-ink"
                : "text-ink-3 hover:text-ink",
            )}
          >
            Active ({totalTasks - doneTasks})
          </Button>
          <Button
            variant="custom"
            type="button"
            onClick={() => setFilter("done")}
            className={cn(
              "px-2 py-0.5 rounded text-xs transition-colors",
              filter === "done"
                ? "bg-muted font-medium text-ink"
                : "text-ink-3 hover:text-ink",
            )}
          >
            Done ({doneTasks})
          </Button>
        </div>
      </div>

      {/* Tasks List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filteredTasks.length === 0 ? (
          <div className="py-12 text-center text-ink-3 space-y-2">
            <ListTodoIcon className="size-8 mx-auto stroke-1 text-ink-3" />
            <p className="text-xs">
              {totalTasks === 0
                ? "No tasks linked to this spec yet."
                : "No tasks match this filter."}
            </p>
            {canCreateTask && totalTasks === 0 && (
              <Button
                variant="outline"
                size="xs"
                className="text-xs"
                onClick={() => onOpenCreateTask()}
              >
                Create First Task
              </Button>
            )}
          </div>
        ) : (
          filteredTasks.map((task) => (
            <LivingSpecItem
              key={task.id}
              task={task}
              canEdit={canEdit}
              updatingTaskKey={updatingTaskKey}
              onStatusChange={handleStatusChange}
              onUnlink={handleUnlink}
            />
          ))
        )}
      </div>

      {/* Quick Add Bar */}
      {canCreateTask && projectId && (
        <form
          onSubmit={handleQuickCreate}
          className="p-3 border-t border-hairline bg-surface/50 flex items-center gap-2"
        >
          <Input
            value={quickTitle}
            onChange={(e) => setQuickTitle(e.target.value)}
            placeholder="Quick add task to spec..."
            className="h-8 text-xs bg-background"
            disabled={isCreatingQuick}
          />
          <Button
            type="submit"
            size="xs"
            disabled={!quickTitle.trim() || isCreatingQuick}
            loading={isCreatingQuick}
            className="h-8 px-2.5"
          >
            <PlusIcon className="size-3.5" />
          </Button>
        </form>
      )}
    </div>
  );
}
