"use client";

import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@kyren/ui/shadcn/collapsible";
import { useState } from "react";

import { useTrpcClient } from "@kyren/api/react";
import { toastError, toastSuccess } from "@kyren/ui/index";
import { Button } from "@kyren/ui/shadcn/button";
import { Input } from "@kyren/ui/shadcn/input";
import { Textarea } from "@kyren/ui/shadcn/textarea";
import { NativeSelect } from "@kyren/ui/shadcn/native-select";

import { usePermission } from "~/src/components/permissions/permission-provider";
import { useAsyncData } from "~/src/lib/use-async-data";

type Priority = "low" | "medium" | "high";

type Draft = {
  id?: string;
  name: string;
  taskDescription: string;
  priority: Priority;
  estimatePoints: string;
  dueInDays: string;
  subtasks: string;
};

const blank: Draft = {
  name: "",
  taskDescription: "",
  priority: "medium",
  estimatePoints: "",
  dueInDays: "",
  subtasks: "",
};

const toNumber = (value: string) => (value.trim() ? Number(value) : null);

/** Start a task, with its usual steps, from a template. Managers edit the templates. */
export function TemplatesPanel({
  projectId,
  onCreated,
}: {
  projectId: string;
  onCreated: () => void;
}) {
  const trpc = useTrpcClient();
  const canManage = usePermission("tasks.manage_templates");
  const [version, setVersion] = useState(0);
  const templates = useAsyncData(
    () => trpc.taskTemplate.list.query(),
    [trpc, version],
  );
  const [draft, setDraft] = useState<Draft>(blank);
  const [busy, setBusy] = useState(false);

  async function run(work: () => Promise<unknown>, done: string) {
    setBusy(true);

    try {
      await work();
      toastSuccess(done);
      setVersion((v) => v + 1);
    } catch (error) {
      toastError(error, "Could not complete that.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Collapsible
      role="group"
      className="rounded-xl border border-line px-4 py-3"
    >
      <CollapsibleTrigger className="w-full text-left before:mr-2 before:inline-block before:content-['▸'] data-[state=open]:before:rotate-90 cursor-pointer text-sm font-medium text-ink">
        Task templates
      </CollapsibleTrigger>
      <CollapsibleContent forceMount className="data-[state=closed]:hidden">
        <ul className="mt-3 flex flex-col gap-1 text-sm">
          {(templates.data ?? []).length === 0 ? (
            <li className="text-ink-2">No templates yet.</li>
          ) : null}
          {(templates.data ?? []).map((template) => (
            <li key={template.id} className="flex items-center gap-2">
              <span className="flex-1 truncate text-ink">
                {template.name}
                {template.subtasks.length
                  ? ` · ${template.subtasks.length} steps`
                  : ""}
              </span>
              <Button
                size="sm"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await trpc.taskTemplate.createFrom.mutate({
                      templateId: template.id,
                      projectId,
                    });
                    onCreated();
                  }, "Task created from template")
                }
              >
                Use
              </Button>
              {canManage ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setDraft({
                        id: template.id,
                        name: template.name,
                        taskDescription: template.taskDescription ?? "",
                        priority: template.priority as Priority,
                        estimatePoints:
                          template.estimatePoints === null
                            ? ""
                            : String(template.estimatePoints),
                        dueInDays:
                          template.dueInDays === null
                            ? ""
                            : String(template.dueInDays),
                        subtasks: template.subtasks.join("\n"),
                      })
                    }
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      void run(
                        () =>
                          trpc.taskTemplate.remove.mutate({ id: template.id }),
                        "Template deleted",
                      )
                    }
                  >
                    Delete
                  </Button>
                </>
              ) : null}
            </li>
          ))}
        </ul>

        {canManage ? (
          <form
            className="mt-3 flex flex-col gap-2 text-sm"
            onSubmit={(event) => {
              event.preventDefault();
              void run(async () => {
                await trpc.taskTemplate.save.mutate({
                  id: draft.id,
                  name: draft.name,
                  taskDescription: draft.taskDescription || null,
                  priority: draft.priority,
                  estimatePoints: toNumber(draft.estimatePoints),
                  dueInDays: toNumber(draft.dueInDays),
                  subtasks: draft.subtasks
                    .split("\n")
                    .map((line) => line.trim())
                    .filter(Boolean),
                });
                setDraft(blank);
              }, "Template saved");
            }}
          >
            <Input
              aria-label="Template name"
              placeholder="Template name, e.g. Onboard a customer"
              maxLength={120}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
            <Textarea
              aria-label="Template description"
              placeholder="Task description"
              rows={2}
              value={draft.taskDescription}
              onChange={(e) =>
                setDraft({ ...draft, taskDescription: e.target.value })
              }
            />
            <Textarea
              aria-label="Template steps"
              placeholder="Steps, one per line (each becomes a sub-task)"
              rows={3}
              value={draft.subtasks}
              onChange={(e) => setDraft({ ...draft, subtasks: e.target.value })}
            />
            <div className="flex flex-wrap items-center gap-2">
              <NativeSelect
                aria-label="Template priority"
                size="sm"
                className="w-28 capitalize"
                value={draft.priority}
                onChange={(e) =>
                  setDraft({ ...draft, priority: e.target.value as Priority })
                }
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </NativeSelect>
              <Input
                aria-label="Template points"
                type="number"
                min={0}
                max={100}
                placeholder="Points"
                className="w-24"
                value={draft.estimatePoints}
                onChange={(e) =>
                  setDraft({ ...draft, estimatePoints: e.target.value })
                }
              />
              <Input
                aria-label="Template due in days"
                type="number"
                min={0}
                placeholder="Due in days"
                className="w-32"
                value={draft.dueInDays}
                onChange={(e) =>
                  setDraft({ ...draft, dueInDays: e.target.value })
                }
              />
              <Button
                type="submit"
                size="sm"
                disabled={busy || !draft.name.trim()}
              >
                {draft.id ? "Save template" : "Add template"}
              </Button>
              {draft.id ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setDraft(blank)}
                >
                  New template
                </Button>
              ) : null}
            </div>
          </form>
        ) : null}
      </CollapsibleContent>
    </Collapsible>
  );
}
