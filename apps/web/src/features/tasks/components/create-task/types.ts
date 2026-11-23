import {
  createTaskSchema,
  type CreateTaskFormValues,
} from "@kyren/api/types/zod-schema";
import { cn } from "@kyren/ui/lib/utils";
import { getDateInputValue as localDateInputValue } from "../task-detail/task-detail-utils";

export type ProjectOption = {
  id: string;
  name: string;
  taskKeyPrefix: string;
  teamName: string | null;
};

export type MemberOption = {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
};

export type Props = {
  defaultProjectId?: string;
  defaultStatus?: CreateTaskFormValues["status"];
  defaultName?: string;
  defaultDescription?: string;
  trigger?: React.ReactNode;
  onTaskCreated?: () => void | Promise<void>;
  /** Control the dialog from outside (the Create menu), with no trigger button. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
  /** Created from a doc: the new task is linked to it. */
  linkDocId?: string;
  /** Created from a chat message: starts with its text, linked back to it. */
  linkMessageId?: string;
};

export const unassignedValue = "unassigned";

export const statusOptions = [
  ["backlog", "Backlog"],
  ["todo", "To do"],
  ["in-progress", "In progress"],
  ["review", "Review"],
  ["done", "Done"],
] as const;

export const formSchema = createTaskSchema.superRefine((values, ctx) => {
  if (!values.dueAt) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (new Date(values.dueAt).getTime() < today.getTime()) {
    ctx.addIssue({
      code: "custom",
      path: ["dueAt"],
      message: "That date has passed. Pick today or later.",
    });
  }
});

export const messages: Partial<Record<keyof CreateTaskFormValues, string>> = {
  name: "Give the task a name so people know what it’s about.",
};

export const getDateInputValue = (value: unknown) => {
  if (value instanceof Date) return localDateInputValue(value);
  return typeof value === "string" ? value : "";
};

export const fieldBox = (invalid: boolean, extra?: string) =>
  cn(
    "h-11 w-full justify-start rounded-md border-hairline bg-surface px-3 text-[15px] shadow-none data-[size=default]:h-11 [&>svg:last-child]:ml-auto",
    extra,
    invalid &&
      "border-danger focus-visible:border-danger focus-visible:ring-danger/22",
  );
