"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

import { useTrpcClient } from "@zentro/api/react";
import type { AppRouter } from "@zentro/api/server";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import { toastError, toastSuccess } from "@zentro/ui/index";
import { Button } from "@zentro/ui/shadcn/button";
import { Input } from "@zentro/ui/shadcn/input";

type SavedTaskView = inferRouterOutputs<AppRouter>["taskView"]["list"][number];
export type ViewConfig = SavedTaskView["config"];
type NewViewConfig =
  inferRouterInputs<AppRouter>["taskView"]["create"]["config"];

/** Pick, save and remove named sets of filters for the task list. */
export function SavedViewsMenu({
  current,
  onApply,
}: {
  current: NewViewConfig;
  onApply: (config: ViewConfig) => void;
}) {
  const trpc = useTrpcClient();
  const [views, setViews] = useState<SavedTaskView[]>([]);
  const [selected, setSelected] = useState("");
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [shared, setShared] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setViews(await trpc.taskView.list.query());
    } catch {
      // Saved views are a convenience; the list works without them.
    }
  }, [trpc]);

  useEffect(() => {
    void load();
  }, [load]);

  const chosen = views.find((view) => view.id === selected);

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);

    try {
      const created = await trpc.taskView.create.mutate({
        name,
        shared,
        config: current,
      });

      toastSuccess("View saved");
      setName("");
      setShared(false);
      setSaving(false);
      await load();
      setSelected(created.id);
    } catch (error) {
      toastError(error, "Could not save the view.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!chosen) return;

    try {
      await trpc.taskView.remove.mutate({ id: chosen.id });
      setSelected("");
      await load();
    } catch (error) {
      toastError(error, "Could not remove the view.");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label="Saved views"
        className="h-8 rounded-lg border border-hairline bg-surface px-2 text-[13px]"
        value={selected}
        onChange={(event) => {
          const view = views.find((entry) => entry.id === event.target.value);

          setSelected(event.target.value);
          if (view) onApply(view.config);
        }}
      >
        <option value="">Saved views</option>
        {views.map((view) => (
          <option key={view.id} value={view.id}>
            {view.name}
            {view.shared && !view.mine ? " (shared)" : ""}
          </option>
        ))}
      </select>

      {chosen?.mine ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={`Remove view ${chosen.name}`}
          onClick={() => void remove()}
        >
          Remove
        </Button>
      ) : null}

      {saving ? (
        <form onSubmit={save} className="flex flex-wrap items-center gap-2">
          <Input
            aria-label="View name"
            className="h-8 w-40"
            value={name}
            maxLength={60}
            autoFocus
            onChange={(event) => setName(event.target.value)}
          />
          <label className="flex items-center gap-1.5 text-[13px] text-ink-2">
            <input
              type="checkbox"
              checked={shared}
              onChange={(event) => setShared(event.target.checked)}
            />
            Share with the team
          </label>
          <Button type="submit" size="sm" disabled={busy || !name.trim()}>
            Save
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setSaving(false)}
          >
            Cancel
          </Button>
        </form>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setSaving(true)}
        >
          Save view
        </Button>
      )}
    </div>
  );
}
