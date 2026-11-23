"use client";

import { Checkbox as ShadcnCheckbox } from "@kyren/ui/shadcn/checkbox";
import { Button } from "@kyren/ui/shadcn/button";
import Link from "next/link";
import type { FC, Ref } from "react";
import { CheckSquareIcon, ClockIcon } from "lucide-react";

import { StatusGlyph, PriorityMeter } from "@kyren/ui/components/status-glyph";
import { cn } from "@kyren/ui/lib/utils";

import { ActorAvatar } from "~/src/components/actor-avatar";
import { DueDate } from "~/src/components/due-date";
import type { BulkChange, WorkspaceTask } from "~/src/features/tasks/lib/types";
import { paths } from "~/src/lib/paths";
import { BlockedChip } from "./../blocked-chip";

export function Checkbox({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: () => void;
}) {
  return (
    <ShadcnCheckbox
      checked={checked}
      onCheckedChange={onChange}
      aria-label={label}
      className="cursor-pointer"
    />
  );
}

export function Assignee({
  task,
  size,
}: {
  task: WorkspaceTask;
  size: number;
}) {
  return task.assignee !== "Unassigned" ? (
    <span title={task.assignee}>
      <ActorAvatar name={task.assignee} size={size} />
    </span>
  ) : (
    <span
      aria-label="Unassigned"
      style={{ width: size, height: size }}
      className="shrink-0 rounded-full border-[1.5px] border-dashed border-line-strong"
    />
  );
}

type ListViewRowProps = {
  task: WorkspaceTask;
  isSelected: boolean;
  isFocused: boolean;
  selectable: boolean;
  onToggle: (id: string) => void;
  onTasksChange?: (tasks: WorkspaceTask[], change: BulkChange) => void;
  rowRef?: Ref<HTMLLIElement>;
};

export const ListViewRow: FC<ListViewRowProps> = ({
  task,
  isSelected,
  isFocused,
  selectable,
  onToggle,
  onTasksChange,
  rowRef,
}) => {
  const done = task.status === "done";

  return (
    <li
      ref={rowRef}
      className={cn(
        "group relative border-b border-hairline/70 transition-colors sm:rounded-md sm:hover:bg-hover",
        isFocused && "bg-signal-subtle/40 ring-1 ring-signal/50 shadow-xs",
        isSelected && "bg-selected sm:hover:bg-selected",
      )}
    >
      {isFocused ? (
        <span className="absolute left-0 top-1 bottom-1 w-1 rounded-r-full bg-signal" />
      ) : null}
      <div className="hidden h-(--row-list) items-center gap-3 px-3 sm:flex">
        {selectable ? (
          <Checkbox
            checked={isSelected}
            onChange={() => onToggle(task.id)}
            label={`Select ${task.key}`}
          />
        ) : null}
        <StatusGlyph status={task.status} size={12} />
        <span className="w-[58px] shrink-0 font-mono text-[13px] text-ink-3 [[data-density=compact]_&]:text-xs">
          {task.key}
        </span>
        <Link
          href={paths.task(task.key)}
          className={cn(
            "min-w-0 flex-1 truncate text-[length:var(--density-body)] outline-none focus-visible:underline",
            done && "text-ink-3",
          )}
        >
          {task.title}
        </Link>
        {done ? null : <BlockedChip blockedBy={task.blockedBy} />}
        {task.subtaskCount && task.subtaskCount.total > 0 ? (
          <span
            title={`${task.subtaskCount.done} of ${task.subtaskCount.total} subtasks completed`}
            className="inline-flex shrink-0 items-center gap-1 rounded-sm border border-hairline bg-surface-subtle px-1.5 py-px font-mono text-[11px] text-ink-2"
          >
            <CheckSquareIcon className="size-3 text-ink-3" />
            <span>
              {task.subtaskCount.done}/{task.subtaskCount.total}
            </span>
          </span>
        ) : null}
        {task.estimatePoints ? (
          <span
            title={`Estimate: ${task.estimatePoints} story points`}
            className="hidden shrink-0 rounded-sm border border-hairline bg-surface-subtle px-1.5 py-px font-mono text-[11px] text-ink-3 sm:inline-flex"
          >
            {task.estimatePoints}pts
          </span>
        ) : null}
        {task.timeSpentMinutes && task.timeSpentMinutes > 0 ? (
          <span
            title={`Time logged: ${task.timeSpentMinutes}m`}
            className="hidden shrink-0 items-center gap-1 rounded-sm border border-hairline bg-surface-subtle px-1.5 py-px font-mono text-[11px] text-ink-3 sm:inline-flex"
          >
            <ClockIcon className="size-3 text-ink-3" />
            {task.timeSpentMinutes >= 60
              ? `${Math.floor(task.timeSpentMinutes / 60)}h`
              : `${task.timeSpentMinutes}m`}
          </span>
        ) : null}
        <span
          title={task.projectName}
          className="hidden shrink-0 rounded-sm border border-hairline px-1.5 py-px font-mono text-[11px] text-ink-3 md:block [[data-density=compact]_&]:hidden"
        >
          {task.key.split("-")[0]}
        </span>
        <span className="flex w-[18px] shrink-0">
          <PriorityMeter priority={task.priority} />
        </span>
        <span className="flex w-6 shrink-0 justify-center">
          <Assignee task={task} size={24} />
        </span>
        {task.status === "backlog" && onTasksChange ? (
          <Button
            variant="custom"
            type="button"
            title="Plan into Active Sprint"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onTasksChange([task], { status: "todo" });
            }}
            className="hidden group-hover:inline-flex items-center gap-1 rounded border border-signal/30 bg-signal-subtle px-1.5 py-0.5 font-mono text-[10px] font-semibold text-signal hover:bg-signal/20 transition-colors shrink-0 cursor-pointer"
          >
            <span>+ Sprint</span>
          </Button>
        ) : null}
        <span className="flex w-[88px] shrink-0 justify-end">
          <DueDate value={task.dueAt} done={done} className="text-[13px]" />
        </span>
      </div>
      {/* Phones: two lines, the title gets the full width. */}
      <div className="flex flex-col gap-1 px-2 py-2.5 sm:hidden">
        <div className="flex items-center gap-2">
          <StatusGlyph status={task.status} size={12} />
          <span className="font-mono text-xs text-ink-3">{task.key}</span>
          <span className="flex-1" />
          <DueDate value={task.dueAt} done={done} />
          <Assignee task={task} size={22} />
        </div>
        <Link
          href={paths.task(task.key)}
          className={cn(
            "pl-5 text-[15px] leading-[22px] outline-none focus-visible:underline",
            done && "text-ink-3",
          )}
        >
          {task.title}
        </Link>
      </div>
    </li>
  );
};
