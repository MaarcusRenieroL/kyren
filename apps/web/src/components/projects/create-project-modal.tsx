"use client";

import { useState } from "react";
import { PlusIcon, XIcon } from "lucide-react";
import { Button } from "@kyren/ui/shadcn/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@kyren/ui/shadcn/dialog";
import { Kbd } from "@kyren/ui/components/kbd";
import { usePermission } from "~/src/components/permissions/permission-provider";
import {
  keyPrefixFor,
  type CreateProjectModalProps,
} from "./create-modal/types";
import { useCreateProjectForm } from "./create-modal/use-create-project-form";
import { CreateProjectFormFields } from "./create-modal/create-project-form-fields";

const CreateProjectModalInner = ({
  onProjectCreated,
  open: controlledOpen,
  onOpenChange,
  hideTrigger = false,
}: CreateProjectModalProps) => {
  const [internalOpen, setInternalOpen] = useState<boolean>(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (value: boolean) => {
    setInternalOpen(value);
    onOpenChange?.(value);
  };

  const {
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
  } = useCreateProjectForm({
    open,
    onProjectCreated,
    setOpen,
  });

  const submit = handleSubmit(onSubmit);
  const prefix = keyPrefixFor(slug);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {hideTrigger ? null : (
        <DialogTrigger asChild>
          <Button className="h-10 px-3.5 font-semibold">
            <PlusIcon />
            New project
          </Button>
        </DialogTrigger>
      )}
      <DialogContent
        showCloseButton={false}
        className="gap-0 p-0 sm:max-w-[560px]"
      >
        <form
          noValidate
          onSubmit={submit}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              void submit();
            }
          }}
        >
          <div className="flex items-center gap-2.5 pt-4 pr-4 pb-2 pl-6">
            <DialogTitle className="text-lg font-semibold">
              New project
            </DialogTitle>
            <span className="flex-1" />
            <DialogClose asChild>
              <Button variant="ghost" size="icon-sm" className="size-8">
                <XIcon />
                <span className="sr-only">Close</span>
              </Button>
            </DialogClose>
            <DialogDescription className="sr-only">
              A project groups tasks and docs under one key, such as ZEN-1.
            </DialogDescription>
          </div>

          <CreateProjectFormFields
            control={control}
            setValue={setValue}
            slug={slug}
            slugEdited={slugEdited}
            setSlugEdited={setSlugEdited}
            isChecking={isChecking}
            visibleAvailability={visibleAvailability}
            teams={teams}
            isLoadingTeams={isLoadingTeams}
          />

          <div className="flex items-center gap-2.5 border-t border-hairline py-3.5 pr-4 pl-6">
            <span className="truncate text-[13px] text-ink-3">
              {prefix
                ? `Tasks will be numbered ${prefix}-1, ${prefix}-2…`
                : "Tasks here get a key like ZEN-1."}
            </span>
            <span className="flex-1" />
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              className="h-10 border-hairline bg-transparent px-3.5"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={isSubmitting}
              disabled={
                isSubmitting || isChecking || visibleAvailability !== true
              }
              className="h-10 px-3.5 font-semibold"
            >
              Create project
              <Kbd className="ml-1 border-transparent bg-on-signal/20 text-on-signal">
                ⌘↵
              </Kbd>
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export const CreateProjectModal = (props: CreateProjectModalProps) => {
  const canCreate = usePermission("projects.create");

  return canCreate ? <CreateProjectModalInner {...props} /> : null;
};
