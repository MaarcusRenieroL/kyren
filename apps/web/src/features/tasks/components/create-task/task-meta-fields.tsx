"use client";

import { Input } from "@zentro/ui/shadcn/input";
import { Control, Controller } from "react-hook-form";
import { AlertCircleIcon, CalendarIcon } from "lucide-react";
import type { CreateTaskFormValues } from "@zentro/api/types/zod-schema";
import { ActorAvatar } from "~/src/components/actor-avatar";
import { PriorityMeter, StatusGlyph } from "@zentro/ui/components/status-glyph";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@zentro/ui/shadcn/select";
import { cn } from "@zentro/ui/lib/utils";

import { dueFromDateInput } from "../task-detail/task-detail-utils";
import {
  fieldBox,
  getDateInputValue,
  statusOptions,
  unassignedValue,
  type MemberOption,
} from "./types";

export function TaskMetaFields({
  control,
  members,
  oooMembers,
  isLoadingMembers,
  assigneeOoo,
  userId,
  FieldError,
  Label,
}: {
  control: Control<CreateTaskFormValues>;
  members: MemberOption[];
  oooMembers: Record<string, { untilDate?: string | null }>;
  isLoadingMembers: boolean;
  assigneeOoo?: { untilDate?: string | null } | null;
  userId?: string | null;
  FieldError: ({ children }: { children?: React.ReactNode }) => React.ReactNode;
  Label: ({
    htmlFor,
    children,
  }: {
    htmlFor?: string;
    children: React.ReactNode;
  }) => React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Controller
        name="status"
        control={control}
        render={({ field }) => (
          <div className="flex flex-col gap-1.5">
            <Label>Status</Label>
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger aria-label="Status" className={fieldBox(false)}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    <StatusGlyph status={value} size={12} decorative />
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      />

      <Controller
        name="priority"
        control={control}
        render={({ field }) => (
          <div className="flex flex-col gap-1.5">
            <Label>Priority</Label>
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger aria-label="Priority" className={fieldBox(false)}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["low", "medium", "high"] as const).map((value) => (
                  <SelectItem key={value} value={value}>
                    <PriorityMeter priority={value} />
                    {value.charAt(0).toUpperCase() + value.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      />

      <Controller
        name="dueAt"
        control={control}
        render={({ field, fieldState }) => (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="task-due-date">Due date</Label>
            <div className="relative">
              <CalendarIcon
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-2"
              />
              <Input
                id="task-due-date"
                type="date"
                aria-invalid={Boolean(fieldState.error)}
                value={getDateInputValue(field.value)}
                onBlur={field.onBlur}
                onChange={(event) =>
                  field.onChange(
                    event.target.value
                      ? dueFromDateInput(event.target.value)
                      : null,
                  )
                }
                className={fieldBox(
                  Boolean(fieldState.error),
                  cn(
                    "border pl-9 font-mono outline-none focus-visible:border-signal focus-visible:ring-[3px] focus-visible:ring-ring/22",
                    !field.value && "text-ink-3",
                  ),
                )}
              />
            </div>
            <FieldError>{fieldState.error?.message}</FieldError>
          </div>
        )}
      />

      <Controller
        name="assignedToMemberId"
        control={control}
        render={({ field }) => (
          <div className="flex flex-col gap-1.5">
            <Label>Assignee</Label>
            <Select
              value={field.value ?? unassignedValue}
              onValueChange={(value) => {
                if (value === "") return;
                field.onChange(value === unassignedValue ? null : value);
              }}
              disabled={isLoadingMembers}
            >
              <SelectTrigger aria-label="Assignee" className={fieldBox(false)}>
                <SelectValue
                  placeholder={
                    isLoadingMembers ? "Loading members..." : "Select assignee"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={unassignedValue}>
                  <span
                    aria-hidden="true"
                    className="size-[22px] rounded-full border-[1.5px] border-dashed border-line-strong"
                  />
                  Unassigned
                </SelectItem>
                {members.map((member) => {
                  const isAway = Boolean(oooMembers[member.id]);
                  return (
                    <SelectItem key={member.id} value={member.id}>
                      <ActorAvatar name={member.name} size={22} />
                      <span>{member.name}</span>
                      {member.userId === userId ? " (you)" : ""}
                      {isAway ? (
                        <span className="ml-1 rounded border border-warning/30 bg-warning-subtle px-1 py-0.2 font-mono text-[10px] font-semibold text-warning-text">
                          Away
                        </span>
                      ) : null}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {assigneeOoo ? (
              <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning-subtle/50 px-2.5 py-1.5 text-xs text-warning-text">
                <AlertCircleIcon className="size-3.5 shrink-0" />
                <span>
                  This teammate is currently <strong>Out of Office</strong>
                  {assigneeOoo.untilDate
                    ? ` until ${assigneeOoo.untilDate}`
                    : ""}
                  . Assignment may delay progress.
                </span>
              </div>
            ) : null}
          </div>
        )}
      />
    </div>
  );
}
