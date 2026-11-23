"use client";

import {
  ChevronDownIcon,
  FileTextIcon,
  LayoutGridIcon,
  PlusIcon,
  SquareCheckIcon,
} from "lucide-react";
import { Kbd } from "@zentro/ui/components/kbd";
import { Button } from "@zentro/ui/shadcn/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@zentro/ui/shadcn/dropdown-menu";

import { CreateProjectModal } from "~/src/components/projects/create-project-modal";
import { CreateDocModal } from "~/src/features/docs/components/pages/home/create-doc-modal";
import { CreateTaskModal } from "~/src/features/tasks/components/create-task-modal";
import { paths } from "~/src/lib/paths";

type Props = {
  canTask: boolean;
  canDoc: boolean;
  canProject: boolean;
  creating: "task" | "project" | "doc" | null;
  setCreating: (item: "task" | "project" | "doc" | null) => void;
  refreshPage: () => void;
  pathname: string;
};

export function TopBarCreateMenu({
  canTask,
  canDoc,
  canProject,
  setCreating,
}: Pick<Props, "canTask" | "canDoc" | "canProject" | "setCreating">) {
  const createItems = [
    canTask
      ? {
          id: "task" as const,
          label: "New task",
          key: "C",
          Icon: SquareCheckIcon,
          tint: "bg-tint-tasks",
        }
      : null,
    canDoc
      ? {
          id: "doc" as const,
          label: "New doc",
          key: "D",
          Icon: FileTextIcon,
          tint: "bg-tint-docs",
        }
      : null,
    canProject
      ? {
          id: "project" as const,
          label: "New project",
          key: "P",
          Icon: LayoutGridIcon,
          tint: "bg-tint-projects",
        }
      : null,
  ].filter((item) => item !== null);

  if (!createItems.length) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          aria-label="Create"
          className="h-8 border-hairline bg-transparent px-2 text-[13px] md:px-2.5"
        >
          <PlusIcon />
          <span className="hidden md:inline">Create</span>
          <ChevronDownIcon className="hidden size-3.5 md:inline" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-58 min-w-58 rounded-2xl p-1.5"
      >
        {createItems.map(({ id, label, key, Icon, tint }) => (
          <DropdownMenuItem
            key={id}
            onSelect={() => setCreating(id)}
            className="h-10 gap-2.5 rounded-md px-2.5 text-sm"
          >
            <span
              aria-hidden="true"
              className={`flex size-[26px] items-center justify-center rounded-sm border border-hairline text-ink ${tint}`}
            >
              <Icon className="size-3.5" />
            </span>
            {label}
            <Kbd className="ml-auto">{key}</Kbd>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TopBarModals({
  creating,
  setCreating,
  refreshPage,
  pathname,
}: Pick<Props, "creating" | "setCreating" | "refreshPage" | "pathname">) {
  return (
    <>
      <CreateTaskModal
        hideTrigger
        open={creating === "task"}
        onOpenChange={(open) => !open && setCreating(null)}
        onTaskCreated={refreshPage}
      />
      <CreateDocModal
        hideTrigger
        open={creating === "doc"}
        onOpenChange={(open) => !open && setCreating(null)}
      />
      <CreateProjectModal
        hideTrigger
        open={creating === "project"}
        onOpenChange={(open) => !open && setCreating(null)}
        onProjectCreated={() => {
          if (pathname === paths.projects()) refreshPage();
        }}
      />
    </>
  );
}
