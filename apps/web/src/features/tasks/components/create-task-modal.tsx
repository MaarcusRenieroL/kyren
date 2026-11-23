"use client";

import {
  type FC,
  type KeyboardEvent,
  useState,
} from "react";
import { PlusIcon, XIcon } from "lucide-react";
import { Button } from "@zentro/ui/shadcn/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@zentro/ui/shadcn/dialog";
import { Kbd } from "@zentro/ui/components/kbd";
import { useReachable } from "~/src/components/permissions/permission-provider";

import { CreateTaskFields } from "./create-task/create-task-fields";
import type { Props } from "./create-task/types";
import { useCreateTaskForm } from "./create-task/use-create-task-form";

const CreateTaskModalInner: FC<Props> = (props) => {
  const {
    trigger,
    open: controlledOpen,
    onOpenChange,
    hideTrigger = false,
  } = props;

  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (value: boolean) => {
    setInternalOpen(value);
    onOpenChange?.(value);
  };

  const {
    control,
    submit,
    isSubmitting,
    errors,
    isSubmitted,
    projects,
    members,
    oooMembers,
    isLoadingProjects,
    isLoadingMembers,
    selected,
    assigneeOoo,
    userId,
    handleOpenChange,
  } = useCreateTaskForm({
    defaultProjectId: props.defaultProjectId,
    defaultStatus: props.defaultStatus,
    defaultName: props.defaultName,
    defaultDescription: props.defaultDescription,
    onTaskCreated: props.onTaskCreated,
    open,
    setOpen,
    linkDocId: props.linkDocId,
    linkMessageId: props.linkMessageId,
  });

  const errorCount = Object.keys(errors).length;

  const onKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      void submit();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {hideTrigger ? null : (
        <DialogTrigger asChild>
          {trigger ?? (
            <Button className="h-10 px-3.5 font-semibold">
              <PlusIcon className="size-4" />
              Create task
            </Button>
          )}
        </DialogTrigger>
      )}

      <DialogContent
        showCloseButton={false}
        className="gap-0 p-0 sm:max-w-[600px]"
      >
        <form noValidate onSubmit={submit} onKeyDown={onKeyDown}>
          <div className="flex items-center gap-2.5 pt-4 pr-4 pb-3 pl-6">
            <DialogTitle className="text-lg font-semibold">
              New task
            </DialogTitle>
            <span className="rounded-sm border border-dashed border-line-strong px-2 py-px font-mono text-xs text-ink-3">
              {selected ? `${selected.taskKeyPrefix}-…` : "No key yet"}
            </span>
            <span className="flex-1" />
            <DialogClose asChild>
              <Button variant="ghost" size="icon-sm" className="size-8">
                <XIcon />
                <span className="sr-only">Close</span>
              </Button>
            </DialogClose>
            <DialogDescription className="sr-only">
              Add work to a project and get the next project task key.
            </DialogDescription>
          </div>

          <CreateTaskFields
            control={control}
            projects={projects}
            members={members}
            oooMembers={oooMembers}
            isLoadingProjects={isLoadingProjects}
            isLoadingMembers={isLoadingMembers}
            selected={selected}
            assigneeOoo={assigneeOoo}
            userId={userId}
          />

          <div className="flex items-center gap-2.5 border-t border-hairline py-3.5 pr-4 pl-6">
            {isSubmitted && errorCount ? (
              <span role="status" className="text-[13px] text-danger-text">
                {errorCount === 1
                  ? "1 field needs a fix before this task can be created."
                  : `${errorCount} fields need a fix before this task can be created.`}
              </span>
            ) : (
              <span className="hidden text-[13px] text-ink-3 sm:block">
                Press C anywhere to open this.
              </span>
            )}
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
              disabled={isSubmitting || isLoadingProjects || !projects.length}
              className="h-10 px-3.5 font-semibold"
            >
              Create task
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

export const CreateTaskModal: FC<Props> = (props) => {
  const canCreate = useReachable("tasks.create");
  return canCreate ? <CreateTaskModalInner {...props} /> : null;
};
