import type { FC } from "react";
import { Controller, type Control, type FieldErrors } from "react-hook-form";
import { Input } from "@zentro/ui/components/shadcn/input";
import { Label } from "@zentro/ui/components/shadcn/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@zentro/ui/components/shadcn/select";
import { Textarea } from "@zentro/ui/components/shadcn/textarea";
import { cn } from "@zentro/ui/index";
import type { ProjectGeneralSectionFormValues } from "~/src/lib/zod-schema";
import type { ProjectData, TeamOption } from "./types";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="flex gap-1.5 text-[13px] text-danger-text">
      <span aria-hidden="true" className="font-mono font-medium">
        !
      </span>
      {message}
    </p>
  );
}

export const GeneralFormFields: FC<{
  control: Control<ProjectGeneralSectionFormValues>;
  errors: FieldErrors<ProjectGeneralSectionFormValues>;
  project: ProjectData;
  teams: TeamOption[];
  isLoadingTeams: boolean;
  descriptionLength: number;
  onFieldChange: () => void;
}> = ({
  control,
  errors,
  project,
  teams,
  isLoadingTeams,
  descriptionLength,
  onFieldChange,
}) => {
  const fieldBox = (invalid: boolean) =>
    cn(
      "h-11 rounded-md border-hairline bg-surface text-[15px] shadow-none",
      invalid && "border-danger",
    );

  return (
    <div className="flex max-w-[620px] flex-col gap-5">
      <Controller
        name="name"
        control={control}
        render={({ field }) => (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="project-name" className="text-[13px]">
              Name
            </Label>
            <Input
              id="project-name"
              autoComplete="off"
              aria-invalid={Boolean(errors.name)}
              className={fieldBox(Boolean(errors.name))}
              {...field}
              onChange={(event) => {
                field.onChange(event);
                onFieldChange();
              }}
            />
            <FieldError message={errors.name?.message} />
          </div>
        )}
      />

      <Controller
        name="slug"
        control={control}
        render={({ field }) => (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="project-slug" className="text-[13px]">
              URL
            </Label>
            <div
              className={cn(
                "flex h-11 items-center rounded-md border bg-surface pl-3 focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/22",
                errors.slug ? "border-danger" : "border-hairline",
              )}
            >
              <span className="shrink-0 font-mono text-[13px] text-ink-3">
                /projects/
              </span>
              <Input
                id="project-slug"
                autoComplete="off"
                aria-invalid={Boolean(errors.slug)}
                className="h-full min-w-0 flex-1 bg-transparent pr-3 pl-1 font-mono text-sm outline-none"
                {...field}
                onChange={(event) => {
                  field.onChange(event);
                  onFieldChange();
                }}
              />
            </div>
            {errors.slug ? (
              <FieldError message={errors.slug.message} />
            ) : (
              <p className="text-[13px] text-ink-3">
                Lowercase letters, numbers and hyphens. Changing it changes the
                project’s address.
              </p>
            )}
          </div>
        )}
      />

      <Controller
        name="description"
        control={control}
        render={({ field }) => (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="project-description" className="text-[13px]">
              Description
            </Label>
            <Textarea
              id="project-description"
              rows={3}
              aria-invalid={Boolean(errors.description)}
              placeholder="What is this project for?"
              className="min-h-20 rounded-md border-hairline bg-surface text-[15px] shadow-none"
              {...field}
              onChange={(event) => {
                field.onChange(event);
                onFieldChange();
              }}
            />
            {errors.description ? (
              <FieldError message={errors.description.message} />
            ) : (
              <p className="text-[13px] text-ink-3">
                Shown on the project tile and overview.{" "}
                {descriptionLength.toLocaleString()} characters.
              </p>
            )}
          </div>
        )}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Controller
          name="teamId"
          control={control}
          render={({ field }) => (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="project-team" className="text-[13px]">
                Team
              </Label>
              <Select
                value={field.value ?? "workspace"}
                onValueChange={(value) => {
                  if (value === "") return;
                  field.onChange(value === "workspace" ? null : value);
                  onFieldChange();
                }}
                disabled={isLoadingTeams}
              >
                <SelectTrigger
                  id="project-team"
                  className="h-11 w-full justify-start gap-2.5 rounded-md border-hairline bg-surface text-[15px] shadow-none data-[size=default]:h-11 [&>svg:last-child]:ml-auto"
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
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium">Key prefix</span>
          <span className="flex h-11 items-center rounded-md border border-hairline bg-sunken px-3 font-mono text-sm text-ink-2">
            {project.taskKeyPrefix ?? "None"}
          </span>
        </div>
      </div>
      <p className="-mt-2 text-[13px] text-ink-3">
        Tasks and docs created here inherit the team. The key prefix is set when
        the project is created, so task keys never change.
      </p>
    </div>
  );
};
