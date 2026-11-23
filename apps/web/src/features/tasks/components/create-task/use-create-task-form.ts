"use client";

import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTrpcClient } from "@kyren/api/react";
import type { CreateTaskFormValues } from "@kyren/api/types/zod-schema";
import { toastError, toastSuccess } from "@kyren/ui/index";
import { useCurrentUserId } from "~/src/components/permissions/permission-provider";

import {
  formSchema,
  type MemberOption,
  type ProjectOption,
} from "./types";

export function useCreateTaskForm({
  defaultProjectId = "",
  defaultStatus = "todo",
  defaultName = "",
  defaultDescription = "",
  onTaskCreated,
  open,
  setOpen,
  linkDocId,
  linkMessageId,
}: {
  defaultProjectId?: string;
  defaultStatus?: CreateTaskFormValues["status"];
  defaultName?: string;
  defaultDescription?: string;
  onTaskCreated?: () => void | Promise<void>;
  open: boolean;
  setOpen: (open: boolean) => void;
  linkDocId?: string;
  linkMessageId?: string;
}) {
  const trpc = useTrpcClient();
  const userId = useCurrentUserId();
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [oooMembers, setOooMembers] = useState<
    Record<string, { untilDate?: string | null }>
  >({});
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);

  const blank = {
    projectId: defaultProjectId,
    name: defaultName,
    description: defaultDescription,
    status: defaultStatus,
    priority: "medium" as const,
    assignedToMemberId: null,
    dueAt: null,
  };

  const form = useForm<CreateTaskFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: blank,
    mode: "onTouched",
  });

  const { control, handleSubmit, reset, setValue, getFieldState, formState } =
    form;

  useEffect(() => {
    if (open) {
      if (defaultName) setValue("name", defaultName);
      if (defaultDescription) setValue("description", defaultDescription);
      if (defaultProjectId) setValue("projectId", defaultProjectId);
    }
  }, [open, defaultName, defaultDescription, defaultProjectId, setValue]);

  const chosenProject = useWatch({ control, name: "projectId" });
  const chosenAssigneeId = useWatch({ control, name: "assignedToMemberId" });
  const selected = projects.find((project) => project.id === chosenProject);
  const assigneeOoo = chosenAssigneeId ? oooMembers[chosenAssigneeId] : null;

  useEffect(() => {
    if (!open) return;

    let isMounted = true;

    const loadOptions = async () => {
      setIsLoadingProjects(true);
      setIsLoadingMembers(true);

      try {
        const [projectList, memberList, oooList] = await Promise.all([
          trpc.project.getProjectsByOrgId.query(),
          trpc.member.getMembers.query().catch(() => []),
          trpc.member.getOutOfOffice.query().catch(() => []),
        ]);

        if (!isMounted) return;

        const oooRecord: Record<string, { untilDate?: string | null }> = {};
        for (const item of oooList) {
          oooRecord[item.memberId] = { untilDate: item.untilDate };
        }
        setOooMembers(oooRecord);

        setProjects(
          projectList
            .filter((project) => project.status === "active")
            .map((project) => ({
              id: project.id,
              name: project.name,
              taskKeyPrefix: project.taskKeyPrefix,
              teamName: project.teamName,
            })),
        );

        setMembers(
          memberList.map((member) => ({
            id: member.id,
            userId: member.userId,
            name: member.name,
            email: member.email,
            role: member.role,
          })),
        );

        const mine = memberList.find((member) => member.userId === userId);

        if (mine && !getFieldState("assignedToMemberId").isDirty) {
          setValue("assignedToMemberId", mine.id);
        }
      } catch {
        toastError("Could not load projects", "Please try again.");
      } finally {
        if (isMounted) {
          setIsLoadingProjects(false);
          setIsLoadingMembers(false);
        }
      }
    };

    void loadOptions();

    return () => {
      isMounted = false;
    };
  }, [getFieldState, open, setValue, trpc, userId]);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      reset(blank);
    }
  };

  const onSubmit = async (values: CreateTaskFormValues) => {
    try {
      const task = await trpc.task.createTask.mutate({
        ...values,
        description: values.description || "",
        assignedToMemberId: values.assignedToMemberId || null,
        dueAt: values.dueAt || null,
        ...(linkDocId ? { linkDocId } : {}),
        ...(linkMessageId ? { linkMessageId } : {}),
      });

      toastSuccess("Task created", `${task.key} is ready.`);
      await onTaskCreated?.();
      reset(blank);
      setOpen(false);
    } catch (error) {
      toastError(
        "Could not create task",
        error instanceof Error ? error.message : "Please try again.",
      );
    }
  };

  return {
    form,
    control,
    submit: handleSubmit(onSubmit),
    isSubmitting: formState.isSubmitting,
    errors: formState.errors,
    isSubmitted: formState.isSubmitted,
    projects,
    members,
    oooMembers,
    isLoadingProjects,
    isLoadingMembers,
    selected,
    assigneeOoo,
    userId,
    handleOpenChange,
  };
}
