"use client";

import { Label as ShadcnLabel } from "@zentro/ui/shadcn/label";
import { Input } from "@zentro/ui/shadcn/input";
import type { ReactNode } from "react";
import { Control, Controller } from "react-hook-form";
import type { CreateTaskFormValues } from "@zentro/api/types/zod-schema";
import { RichTextEditor } from "@zentro/ui/components/rich-text-editor";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@zentro/ui/shadcn/select";

import { TaskMetaFields } from "./task-meta-fields";
import {
  fieldBox,
  messages,
  type MemberOption,
  type ProjectOption,
} from "./types";

function FieldError({ children }: { children?: ReactNode }) {
  if (!children) return null;

  return (
    <p
      role="alert"
      className="flex gap-1.5 text-[13px] leading-5 text-danger-text"
    >
      <span aria-hidden="true" className="font-mono font-medium">
        !
      </span>
      {children}
    </p>
  );
}

function Label({
  htmlFor,
  children,
}: {
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <ShadcnLabel htmlFor={htmlFor} className="text-[13px] font-medium text-ink">
      {children}
    </ShadcnLabel>
  );
}

export function CreateTaskFields({
  control,
  projects,
  members,
  oooMembers,
  isLoadingProjects,
  isLoadingMembers,
  selected,
  assigneeOoo,
  userId,
}: {
  control: Control<CreateTaskFormValues>;
  projects: ProjectOption[];
  members: MemberOption[];
  oooMembers: Record<string, { untilDate?: string | null }>;
  isLoadingProjects: boolean;
  isLoadingMembers: boolean;
  selected?: ProjectOption;
  assigneeOoo?: { untilDate?: string | null } | null;
  userId?: string | null;
}) {
  return (
    <div className="flex flex-col gap-4 px-6 pt-1 pb-5">
      <Controller
        name="projectId"
        control={control}
        render={({ field, fieldState }) => (
          <div className="flex flex-col gap-1.5">
            <Label>Project</Label>
            <Select
              value={field.value ?? ""}
              onValueChange={(value) => {
                if (value !== "") field.onChange(value);
              }}
              onOpenChange={(isOpen) => {
                if (!isOpen) field.onBlur();
              }}
              disabled={isLoadingProjects || !projects.length}
            >
              <SelectTrigger
                aria-invalid={Boolean(fieldState.error)}
                aria-label="Project"
                className={fieldBox(Boolean(fieldState.error))}
              >
                {selected ? (
                  <span className="flex size-[22px] shrink-0 items-center justify-center rounded-[7px] bg-tint-projects font-mono text-[10px] text-ink">
                    {selected.name.charAt(0).toUpperCase()}
                  </span>
                ) : (
                  <span
                    aria-hidden="true"
                    className="size-[22px] shrink-0 rounded-[7px] border-[1.5px] border-dashed border-line-strong"
                  />
                )}
                <SelectValue
                  placeholder={
                    isLoadingProjects
                      ? "Loading projects..."
                      : "Choose a project"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                    <span className="font-mono text-xs text-ink-3">
                      {project.taskKeyPrefix}
                      {project.teamName ? ` · ${project.teamName}` : ""}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!isLoadingProjects && !projects.length ? (
              <p className="text-[13px] text-ink-3">
                No active projects are available.
              </p>
            ) : null}
            <FieldError>{fieldState.error?.message}</FieldError>
          </div>
        )}
      />

      <Controller
        name="name"
        control={control}
        render={({ field, fieldState }) => (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="task-name">Task name</Label>
            <Input
              id="task-name"
              placeholder="What needs to happen?"
              aria-invalid={Boolean(fieldState.error)}
              className={fieldBox(
                Boolean(fieldState.error),
                "border outline-none placeholder:text-ink-3 focus-visible:border-signal focus-visible:ring-[3px] focus-visible:ring-ring/22",
              )}
              {...field}
            />
            <FieldError>
              {fieldState.error
                ? (messages.name ?? fieldState.error.message)
                : null}
            </FieldError>
          </div>
        )}
      />

      <Controller
        name="description"
        control={control}
        render={({ field, fieldState }) => (
          <div className="flex flex-col gap-1.5">
            <Label>Description</Label>
            <RichTextEditor
              value={field.value ?? ""}
              showActions={false}
              onChange={field.onChange}
              onSave={field.onChange}
              placeholder="Add details, steps or links."
              minHeightClassName="[&_.ProseMirror]:min-h-[60px]"
            />
            <FieldError>{fieldState.error?.message}</FieldError>
          </div>
        )}
      />

      <TaskMetaFields
        control={control}
        members={members}
        oooMembers={oooMembers}
        isLoadingMembers={isLoadingMembers}
        assigneeOoo={assigneeOoo}
        userId={userId}
        FieldError={FieldError}
        Label={Label}
      />
    </div>
  );
}
