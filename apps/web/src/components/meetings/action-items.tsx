"use client";

import { Label } from "@zentro/ui/shadcn/label";
import { Checkbox } from "@zentro/ui/shadcn/checkbox";
import { useState } from "react";
import { useTrpcClient } from "@zentro/api/react";
import { Button } from "@zentro/ui/shadcn/button";
import { NativeSelect } from "@zentro/ui/shadcn/native-select";
import { toastError, toastSuccess } from "@zentro/ui/index";
import { useAsyncData } from "~/src/lib/use-async-data";

/** Action items from the AI recap, ready to become tasks in a chosen project. */
export function ActionItems({
  meetingId,
  items,
}: {
  meetingId: string;
  items: string[];
}) {
  const trpc = useTrpcClient();
  const projects = useAsyncData(
    () => trpc.project.getProjectsByOrgId.query(),
    [trpc],
  );
  const [picked, setPicked] = useState<string[]>(items);
  const [projectId, setProjectId] = useState("");
  const [made, setMade] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  if (!items.length) return null;

  async function create() {
    setBusy(true);

    try {
      const result = await trpc.meeting.createTasks.mutate({
        id: meetingId,
        projectId,
        titles: picked,
      });

      setMade(result.keys);
      toastSuccess(`Created ${result.keys.length} tasks`);
    } catch (error) {
      toastError(error, "Could not create the tasks.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-line pt-3">
      <h3 className="text-xs font-semibold text-ink-2">Action items</h3>
      {items.map((item) => (
        <Label key={item} className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={picked.includes(item)}
            onCheckedChange={(checked) =>
              setPicked((current) =>
                checked === true
                  ? [...current, item]
                  : current.filter((value) => value !== item),
              )
            }
          />
          {item}
        </Label>
      ))}
      <div className="flex flex-wrap items-center gap-2">
        <NativeSelect
          aria-label="Project for the tasks"
          size="sm"
          className="w-48 text-sm"
          value={projectId}
          onChange={(event) => setProjectId(event.target.value)}
        >
          <option value="">Choose a project</option>
          {(projects.data ?? []).map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </NativeSelect>
        <Button
          size="sm"
          disabled={busy || !projectId || !picked.length}
          onClick={() => void create()}
        >
          Create {picked.length} tasks
        </Button>
        {made.length ? (
          <span className="text-xs text-ink-2">Created {made.join(", ")}</span>
        ) : null}
      </div>
    </div>
  );
}
