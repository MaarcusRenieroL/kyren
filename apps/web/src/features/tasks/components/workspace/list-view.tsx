"use client";

import { Button } from "@zentro/ui/shadcn/button";
import { useMemo, useState, type FC, type ReactNode } from "react";
import { ChevronDownIcon, ChevronRightIcon, PlusIcon } from "lucide-react";

import { StatusGlyph } from "@zentro/ui/components/status-glyph";

import { ShortcutsDialog } from "~/src/components/shortcuts-dialog";
import type { BulkChange, WorkspaceTask } from "~/src/features/tasks/lib/types";

import { CreateTaskModal } from "../create-task-modal";
import { BulkBar } from "./bulk-bar";
import { EmptyTasks } from "./empty-tasks";
import type { TaskGroup, TaskSort } from "./task-workspace-header";
import { buildSections, sortTasks } from "./list-view/list-view-helpers";
import { ListViewRow } from "./list-view/list-view-row";
import { ListViewShortcuts } from "./list-view/list-view-shortcuts";
import { useListViewShortcuts } from "./list-view/use-list-view-shortcuts";

type Props = {
  tasks: WorkspaceTask[];
  group?: TaskGroup;
  sort?: TaskSort;
  onTasksChange?: (tasks: WorkspaceTask[], change: BulkChange) => void;
  onTasksDelete?: (tasks: WorkspaceTask[]) => void;
  onTaskCreated?: () => void | Promise<void>;
  /** Shown instead of the default empty state, e.g. when filters hide all. */
  empty?: ReactNode;
};

export const ListView: FC<Props> = ({
  tasks,
  group = "state",
  sort = "due",
  onTasksChange,
  onTasksDelete,
  onTaskCreated,
  empty,
}) => {
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const sections = useMemo(
    () => buildSections(sortTasks(tasks, sort), group),
    [tasks, sort, group],
  );

  const visibleTasks = useMemo(() => {
    return sections.flatMap((section) => {
      const isClosed = closed[section.id] ?? section.collapsed;
      return isClosed ? [] : section.rows;
    });
  }, [sections, closed]);

  const chosen = tasks.filter((task) => selected.has(task.id));
  const selectable = Boolean(onTasksChange || onTasksDelete);
  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const { focusedIndex, focusedRowRef } = useListViewShortcuts({
    visibleTasks,
    chosen,
    selected,
    setSelected,
    toggle,
    onTasksChange,
    setCreateModalOpen,
    setShortcutsOpen,
  });

  if (!tasks.length) return empty ?? <EmptyTasks />;

  return (
    <div className="flex flex-col gap-1.5" data-testid="task-list">
      {sections.map((section) => {
        const isClosed = closed[section.id] ?? section.collapsed;

        return (
          <section key={section.id} aria-label={section.label} className="mb-4">
            <h3 className="m-0 flex h-9 items-center rounded-lg bg-surface/50 border border-hairline/60 pr-1 hover:bg-hover/80 transition-colors mb-1 sm:pr-2">
              <Button
                variant="custom"
                type="button"
                aria-expanded={!isClosed}
                onClick={() =>
                  setClosed((current) => ({
                    ...current,
                    [section.id]: !isClosed,
                  }))
                }
                className="flex h-full min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2 text-left text-xs font-semibold uppercase tracking-wider text-ink outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-3"
              >
                {isClosed ? (
                  <ChevronRightIcon
                    aria-hidden="true"
                    className="size-3.5 text-ink-3"
                  />
                ) : (
                  <ChevronDownIcon
                    aria-hidden="true"
                    className="size-3.5 text-ink-3"
                  />
                )}
                {section.status ? (
                  <StatusGlyph status={section.status} size={12} decorative />
                ) : null}
                <span className="font-semibold">{section.label}</span>
                <span className="font-mono text-xs text-ink-3">
                  {section.rows.length}
                </span>
              </Button>
              {section.status && onTaskCreated ? (
                <CreateTaskModal
                  defaultStatus={section.status}
                  onTaskCreated={onTaskCreated}
                  trigger={
                    <Button
                      variant="custom"
                      type="button"
                      aria-label={`Create a task in ${section.label}`}
                      className="hidden size-7 items-center justify-center rounded-sm text-ink-3 outline-none hover:bg-hover hover:text-ink focus-visible:ring-2 focus-visible:ring-ring sm:flex"
                    >
                      <PlusIcon aria-hidden="true" className="size-4" />
                    </Button>
                  }
                />
              ) : null}
            </h3>
            {isClosed ? null : (
              <ul>
                {section.rows.map((task) => {
                  const isSelected = selected.has(task.id);
                  const isFocused =
                    focusedIndex !== null &&
                    visibleTasks[focusedIndex]?.id === task.id;

                  return (
                    <ListViewRow
                      key={task.id}
                      task={task}
                      isSelected={isSelected}
                      isFocused={isFocused}
                      selectable={selectable}
                      onToggle={toggle}
                      onTasksChange={onTasksChange}
                      rowRef={
                        isFocused
                          ? (el) => {
                              focusedRowRef.current = el;
                            }
                          : undefined
                      }
                    />
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}

      {chosen.length > 0 ? (
        <BulkBar
          selected={chosen}
          onChange={onTasksChange}
          onDelete={onTasksDelete}
          onClear={() => setSelected(new Set())}
        />
      ) : null}

      <ListViewShortcuts onOpenShortcuts={() => setShortcutsOpen(true)} />

      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />

      <CreateTaskModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onTaskCreated={onTaskCreated}
        hideTrigger
      />
    </div>
  );
};
