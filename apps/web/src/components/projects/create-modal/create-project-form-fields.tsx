"use client";

import { Label } from "@kyren/ui/shadcn/label";
import type { FC } from "react";
import {
  Controller,
  type Control,
  type UseFormSetValue,
} from "react-hook-form";
import { Check } from "lucide-react";
import type { CreateProjectFormValues } from "@kyren/api/types/zod-schema";
import { Input } from "@kyren/ui/shadcn/input";
import { Textarea } from "@kyren/ui/shadcn/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@kyren/ui/shadcn/select";
import { cn } from "@kyren/ui/lib/utils";
import { LoadingState } from "@kyren/ui/components/loading-state";
import { slugify, slugifyInput } from "@kyren/utils";
import { box, FieldError, type TeamOption } from "./types";

type CreateProjectFormFieldsProps = {
  control: Control<CreateProjectFormValues>;
  setValue: UseFormSetValue<CreateProjectFormValues>;
  slug: string;
  slugEdited: boolean;
  setSlugEdited: (edited: boolean) => void;
  isChecking: boolean;
  visibleAvailability: boolean | null;
  teams: TeamOption[];
  isLoadingTeams: boolean;
};

export const CreateProjectFormFields: FC<CreateProjectFormFieldsProps> = ({
  control,
  setValue,
  slug,
  slugEdited,
  setSlugEdited,
  isChecking,
  visibleAvailability,
  teams,
  isLoadingTeams,
}) => {
  return (
    <div className="flex flex-col gap-4 px-6 pt-2 pb-5">
      <Controller
        name="name"
        control={control}
        render={({ field, fieldState }) => (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="project-name" className="text-[13px] font-medium">
              Name
            </Label>
            <Input
              id="project-name"
              placeholder="Marketing Site"
              className={box}
              aria-invalid={Boolean(fieldState.error)}
              name={field.name}
              ref={field.ref}
              value={field.value}
              onBlur={field.onBlur}
              onChange={(event) => {
                field.onChange(event);

                if (!slugEdited) {
                  setValue("slug", slugify(event.target.value), {
                    shouldDirty: true,
                    shouldTouch: true,
                    shouldValidate: true,
                  });
                }
              }}
            />
            <FieldError message={fieldState.error?.message} />
          </div>
        )}
      />

      <Controller
        name="slug"
        control={control}
        render={({ field, fieldState }) => (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="project-slug" className="text-[13px] font-medium">
              URL
            </Label>
            <div
              className={cn(
                "flex h-11 items-center gap-1 rounded-md border bg-surface pr-3 pl-3 focus-within:ring-[3px]",
                visibleAvailability === false || fieldState.error
                  ? "border-danger focus-within:ring-danger/22"
                  : "border-hairline focus-within:border-signal focus-within:ring-ring/22",
              )}
            >
              <span className="shrink-0 font-mono text-[13px] text-ink-3">
                /projects/
              </span>
              <Input
                id="project-slug"
                placeholder="marketing-site"
                aria-invalid={
                  visibleAvailability === false || Boolean(fieldState.error)
                }
                className="h-full min-w-0 flex-1 bg-transparent font-mono text-sm outline-none placeholder:text-ink-3"
                name={field.name}
                ref={field.ref}
                value={field.value}
                onBlur={field.onBlur}
                onChange={(event) => {
                  setSlugEdited(true);
                  field.onChange(slugifyInput(event.target.value));
                }}
              />
              {slug ? (
                isChecking ? (
                  <LoadingState
                    label="Checking project URL"
                    className="min-h-0"
                    showLabel={false}
                  />
                ) : visibleAvailability ? (
                  <span className="flex items-center gap-1.5 font-mono text-xs text-success-text">
                    <span className="flex size-3.5 items-center justify-center rounded-full bg-success text-on-success">
                      <Check className="size-2.5" strokeWidth={3} />
                    </span>
                    Available
                  </span>
                ) : visibleAvailability === false ? (
                  <span className="font-mono text-xs text-danger-text">
                    Taken
                  </span>
                ) : null
              ) : null}
            </div>
            {fieldState.error ? (
              <FieldError message={fieldState.error.message} />
            ) : visibleAvailability === false ? (
              <FieldError message="Another project uses this URL. Add a word, like marketing-site-2." />
            ) : (
              <p className="text-[13px] text-ink-3">
                Checked as you type. You can change it later in project
                settings.
              </p>
            )}
          </div>
        )}
      />

      <Controller
        name="description"
        control={control}
        render={({ field, fieldState }) => (
          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor="project-description"
              className="text-[13px] font-medium"
            >
              Description{" "}
              <span className="font-normal text-ink-3">optional</span>
            </Label>
            <Textarea
              id="project-description"
              placeholder="What is this project for?"
              className="min-h-[72px] rounded-md border-hairline bg-surface text-[15px] shadow-none"
              rows={2}
              {...field}
            />
            <FieldError message={fieldState.error?.message} />
          </div>
        )}
      />

      <Controller
        name="teamId"
        control={control}
        render={({ field }) => (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="project-team" className="text-[13px] font-medium">
              Team
            </Label>
            <Select
              value={field.value ?? "workspace"}
              onValueChange={(value) => {
                if (value === "") return;
                field.onChange(value === "workspace" ? null : value);
              }}
              disabled={isLoadingTeams}
            >
              <SelectTrigger
                id="project-team"
                className={cn(
                  box,
                  "w-full justify-start gap-2.5 data-[size=default]:h-11 [&>svg:last-child]:ml-auto",
                )}
              >
                <span
                  aria-hidden="true"
                  className="size-2.5 rounded-[3px] border border-hairline bg-tint-teams"
                />
                <SelectValue
                  placeholder={
                    isLoadingTeams ? "Loading teams..." : "Select team"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="workspace">Workspace level</SelectItem>
                {teams.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      />
    </div>
  );
};
