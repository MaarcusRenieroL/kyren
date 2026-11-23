"use client";

import { paths } from "~/src/lib/paths";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTrpcClient } from "@kyren/api/react";
import { Button } from "@kyren/ui/components/shadcn/button";
import { toastError, toastSuccess } from "@kyren/ui/index";
import { CheckCircle2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { FC, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import {
  ProjectGeneralSectionFormValues,
  projectGeneralSectionSchema,
} from "~/src/lib/zod-schema";
import {
  getErrorMessage,
  type ProjectData,
  type TeamOption,
} from "./general/types";
import { ProjectPreviewCard } from "./general/project-preview-card";
import { GeneralFormFields } from "./general/general-form-fields";

type Props = {
  project: ProjectData;
};

export const GeneralSection: FC<Props> = ({ project }) => {
  const [saveState, setSaveState] = useState<"idle" | "saved">("idle");
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [isLoadingTeams, setIsLoadingTeams] = useState(true);
  const trpc = useTrpcClient();
  const router = useRouter();

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty, isSubmitting, dirtyFields },
  } = useForm<ProjectGeneralSectionFormValues>({
    resolver: zodResolver(projectGeneralSectionSchema),
    defaultValues: {
      name: project.name,
      slug: project.slug,
      description: project.description ?? "",
      teamId: project.teamId,
    },
    mode: "onTouched",
  });

  const preview = watch();
  const previewTeam = teams.find((team) => team.id === preview.teamId);

  useEffect(() => {
    let cancelled = false;

    async function loadTeams() {
      setIsLoadingTeams(true);
      try {
        const teamList = await trpc.team.getAll.query();
        if (!cancelled) {
          setTeams(teamList);
        }
      } catch (error) {
        if (!cancelled) {
          toastError("Failed to load teams", getErrorMessage(error));
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
  }, [trpc]);

  const handleCancel = () => {
    reset({
      name: project.name,
      slug: project.slug,
      description: project.description ?? "",
      teamId: project.teamId,
    });
    setSaveState("idle");
  };

  const handleSave = async (values: ProjectGeneralSectionFormValues) => {
    try {
      const updatedProject = await trpc.project.updateProjectBySlug.mutate({
        currentSlug: project.slug,
        name: values.name,
        slug: values.slug,
        description: values.description,
        teamId: values.teamId ?? null,
      });

      toastSuccess("Success", "Project updated successfully.");

      reset({
        name: updatedProject.name,
        slug: updatedProject.slug,
        description: updatedProject.description ?? "",
        teamId: updatedProject.teamId,
      });

      setSaveState("saved");

      if (updatedProject.slug !== project.slug) {
        router.replace(paths.projectGeneralSettings(updatedProject.slug));
        return;
      }

      window.setTimeout(() => {
        setSaveState("idle");
      }, 2500);
    } catch (error) {
      setSaveState("idle");
      toastError("Failed to update project", getErrorMessage(error));
    }
  };

  const changed = (
    [
      ["name", "the name"],
      ["slug", "the URL"],
      ["description", "the description"],
      ["teamId", "the team"],
    ] as const
  )
    .filter(([key]) => dirtyFields[key])
    .map(([, label]) => label);
  const changedText =
    changed.length > 1
      ? `${changed.slice(0, -1).join(", ")} and ${changed[changed.length - 1]}`
      : changed[0];
  const descriptionLength = (preview.description ?? "").length;

  return (
    <form
      noValidate
      className="flex flex-col gap-6 pb-6"
      onSubmit={handleSubmit(handleSave)}
    >
      {saveState === "saved" ? (
        <div
          role="status"
          className="flex items-center gap-3 rounded-md border border-success/30 bg-success-subtle px-4 py-3 text-sm"
        >
          <CheckCircle2Icon className="size-4 text-success" />
          Project settings saved.
        </div>
      ) : null}

      <div className="grid grid-cols-1 items-start gap-8 xl:grid-cols-[minmax(0,1fr)_280px]">
        <GeneralFormFields
          control={control}
          errors={errors}
          project={project}
          teams={teams}
          isLoadingTeams={isLoadingTeams}
          descriptionLength={descriptionLength}
          onFieldChange={() => setSaveState("idle")}
        />

        <ProjectPreviewCard
          project={project}
          preview={preview}
          previewTeam={previewTeam}
        />
      </div>

      {isDirty ? (
        <div
          role="status"
          className="sticky bottom-4 z-(--z-sticky) flex max-w-[620px] flex-wrap items-center gap-2.5 rounded-xl border border-hairline bg-overlay py-2.5 pr-2.5 pl-4 shadow-lg motion-safe:animate-fade-up"
        >
          <span
            aria-hidden="true"
            className="size-2 rounded-full bg-status-progress"
          />
          <span className="text-sm">
            You changed {changedText ?? "this project"}.
          </span>
          <span className="flex-1" />
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={isSubmitting}
            className="h-9 border-hairline bg-transparent px-3"
          >
            Discard
          </Button>
          <Button
            type="submit"
            loading={isSubmitting}
            disabled={isSubmitting}
            className="h-9 px-3 font-semibold"
          >
            Save changes
          </Button>
        </div>
      ) : null}
    </form>
  );
};
