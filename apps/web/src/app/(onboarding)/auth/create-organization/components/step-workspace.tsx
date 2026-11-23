"use client";

import { CheckIcon } from "lucide-react";
import {
  Controller,
  type Control,
  type UseFormSetValue,
} from "react-hook-form";
import { cn } from "@zentro/ui/lib/utils";
import { Input } from "@zentro/ui/shadcn/input";
import { slugify, slugifyInput } from "@zentro/utils";
import { AuthField } from "~/src/features/auth/components/kit/auth-kit";
import type { CreateOrganizationFormValues } from "~/src/features/auth/lib/zod-schema";

type StepWorkspaceProps = {
  control: Control<CreateOrganizationFormValues>;
  setValue: UseFormSetValue<CreateOrganizationFormValues>;
  created: boolean;
  slugEdited: boolean;
  setSlugEdited: (v: boolean) => void;
  workspaceSlug: string;
  visibleSlugAvailability: boolean | null;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
};

export function StepWorkspace({
  control,
  setValue,
  created,
  slugEdited,
  setSlugEdited,
  workspaceSlug,
  visibleSlugAvailability,
  onSubmit,
}: StepWorkspaceProps) {
  return (
    <form
      id="workspace-form"
      noValidate
      onSubmit={onSubmit}
      className="tile flex flex-col gap-4 p-[22px]"
    >
      <Controller
        name="name"
        control={control}
        render={({ field, fieldState }) => (
          <AuthField
            label="Workspace name"
            htmlFor="name"
            hint="Usually your company or team name. You can change it later."
            error={fieldState.error?.message}
          >
            <Input
              id="name"
              type="text"
              placeholder="Northwind Labs"
              autoComplete="organization"
              readOnly={created}
              aria-invalid={fieldState.invalid || undefined}
              aria-describedby={fieldState.error ? "name-error" : undefined}
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
          </AuthField>
        )}
      />

      <Controller
        name="slug"
        control={control}
        render={({ field, fieldState }) => {
          const taken = visibleSlugAvailability === false;

          return (
            <AuthField
              label="Workspace URL"
              htmlFor="slug"
              error={
                fieldState.error?.message ??
                (taken
                  ? `zentro.app/${workspaceSlug} is taken. Try ${workspaceSlug}-labs or ${workspaceSlug}-hq.`
                  : undefined)
              }
            >
              <div
                className={cn(
                  "flex h-(--control-h) items-center overflow-hidden rounded-md border border-border-strong bg-surface font-mono text-sm focus-within:border-ring focus-within:ring-4 focus-within:ring-ring/22",
                  (fieldState.invalid || taken) && "border-danger",
                )}
              >
                <span className="flex h-full items-center border-r border-hairline px-3 text-ink-3">
                  zentro.app/
                </span>
                <Input
                  id="slug"
                  type="text"
                  placeholder="northwind-labs"
                  readOnly={created}
                  aria-invalid={fieldState.invalid || taken || undefined}
                  aria-describedby={
                    fieldState.error || taken ? "slug-error" : undefined
                  }
                  className="h-full min-w-0 flex-1 bg-transparent px-2.5 outline-none placeholder:text-ink-3"
                  name={field.name}
                  ref={field.ref}
                  value={field.value}
                  onBlur={field.onBlur}
                  onChange={(event) => {
                    setSlugEdited(true);
                    field.onChange(slugifyInput(event.target.value));
                  }}
                />
              </div>
              {workspaceSlug && !fieldState.error && !taken && !created ? (
                <p className="flex items-center gap-1.5 text-[13px] leading-5 text-ink-2">
                  {visibleSlugAvailability ? (
                    <>
                      <span className="flex size-3.5 items-center justify-center rounded-full bg-success text-on-success">
                        <CheckIcon
                          className="size-2.5"
                          strokeWidth={3.5}
                          aria-hidden="true"
                        />
                      </span>
                      Available. Lowercase letters, numbers and dashes only.
                    </>
                  ) : (
                    <>Checking {workspaceSlug}…</>
                  )}
                </p>
              ) : null}
            </AuthField>
          );
        }}
      />
    </form>
  );
}
