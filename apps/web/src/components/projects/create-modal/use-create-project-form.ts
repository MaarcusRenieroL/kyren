"use client";

import { useCallback, useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTrpcClient } from "@zentro/api/react";
import {
  CreateProjectFormValues,
  createProjectSchema,
} from "@zentro/api/types/zod-schema";
import { useSlugAvailability } from "@zentro/ui/hooks/use-slug-availability";
import { toastError, toastSuccess } from "@zentro/ui/index";
import type { TeamOption } from "./types";

type UseCreateProjectFormParams = {
  open: boolean;
  onProjectCreated: () => void | Promise<void>;
  setOpen: (open: boolean) => void;
};

export function useCreateProjectForm({
  open,
  onProjectCreated,
  setOpen,
}: UseCreateProjectFormParams) {
  const [slugEdited, setSlugEdited] = useState(false);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [isLoadingTeams, setIsLoadingTeams] = useState(false);

  const trpc = useTrpcClient();

  const checkProjectSlug = useCallback(
    async (slugToCheck: string) => {
      const result = await trpc.project.checkSlug.query({
        slug: slugToCheck,
      });

      return result.available;
    },
    [trpc],
  );

  const form = useForm<CreateProjectFormValues>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: {
      name: "",
      slug: "",
      description: "",
      teamId: null,
    },
    mode: "onTouched",
  });

  const {
    handleSubmit,
    control,
    reset,
    setValue,
    formState: { isSubmitting },
  } = form;

  const slug = useWatch({ control, name: "slug" }) ?? "";

  const { isChecking, visibleAvailability } = useSlugAvailability({
    slug,
    checkSlug: checkProjectSlug,
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    async function loadTeams() {
      setIsLoadingTeams(true);

      try {
        const teamList = await trpc.team.getAll.query();

        if (!cancelled) {
          setTeams(teamList);
        }
      } catch {
        if (!cancelled) {
          toastError("Error", "Could not load teams");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingTeams(false);
        }
      }
    }

    void loadTeams();

    return () => {
      cancelled = true;
    };
  }, [open, trpc]);

  const onSubmit = async (formValues: CreateProjectFormValues) => {
    if (visibleAvailability !== true) {
      return;
    }

    try {
      await trpc.project.createProject.mutate({
        name: formValues.name,
        slug: formValues.slug,
        description: formValues.description,
        teamId: formValues.teamId ?? null,
      });

      toastSuccess("Success", "Project created successfully");

      await onProjectCreated();
      reset();
      setSlugEdited(false);
      setOpen(false);
    } catch (error) {
      toastError(
        "Error",
        error instanceof Error ? error.message : "Please try again.",
      );
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);

    if (!nextOpen) {
      reset();
      setSlugEdited(false);
    }
  };

  return {
    form,
    control,
    setValue,
    slug,
    slugEdited,
    setSlugEdited,
    teams,
    isLoadingTeams,
    isSubmitting,
    isChecking,
    visibleAvailability,
    handleSubmit,
    onSubmit,
    handleOpenChange,
  };
}
