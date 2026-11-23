"use client";

import { useEffect, useState } from "react";
import { useTrpcClient } from "@zentro/api/react";
import { Combobox } from "@zentro/ui/components/combobox";
import { ListFilterIcon } from "lucide-react";
import { Button } from "@zentro/ui/shadcn/button";
import { Input } from "@zentro/ui/shadcn/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@zentro/ui/shadcn/popover";
import { emptyFileFilters, type FileFilters, type Folder } from "./types";
import { FileDateFilter } from "./file-date-filter";

export function FilesFilters({
  filters,
  folders,
  onChange,
}: {
  filters: FileFilters;
  folders: Folder[];
  onChange: (filters: FileFilters) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(filters);
  const trpc = useTrpcClient();
  const [people, setPeople] = useState<
    { value: string; label: string; hint: string }[]
  >([]);
  const [peopleState, setPeopleState] = useState<
    "loading" | "ready" | "unavailable"
  >("loading");

  useEffect(() => {
    if (!open) return;
    let active = true;
    void trpc.member.getMembers.query().then(
      (members) => {
        if (!active) return;
        setPeople(
          members.map(({ id, name, email }) => ({
            value: id,
            label: name,
            hint: email,
          })),
        );
        setPeopleState("ready");
      },
      () => {
        if (!active) return;
        setPeople([]);
        setPeopleState("unavailable");
      },
    );
    return () => {
      active = false;
    };
  }, [open, trpc]);
  const activeCount = Object.values(filters).filter(Boolean).length;
  const invalidSize =
    draft.minSize !== "" &&
    draft.maxSize !== "" &&
    Number(draft.minSize) > Number(draft.maxSize);
  const invalidDates = Boolean(
    draft.uploadedFrom &&
    draft.uploadedThrough &&
    draft.uploadedFrom > draft.uploadedThrough,
  );

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) setDraft(filters);
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <ListFilterIcon aria-hidden />
          Filters{activeCount > 0 ? ` (${activeCount})` : ""}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (invalidSize || invalidDates) return;
            onChange(draft);
            setOpen(false);
          }}
        >
          <div className="grid gap-1 text-sm">
            <span>Uploaded by</span>
            <Combobox
              aria-label="Uploaded by"
              options={[{ value: "", label: "Anyone" }, ...people]}
              value={draft.uploaderId}
              onValueChange={(uploaderId) => setDraft({ ...draft, uploaderId })}
              searchPlaceholder="Search workspace members"
              emptyText={
                peopleState === "loading"
                  ? "Loading workspace members…"
                  : peopleState === "unavailable"
                    ? "Workspace members are unavailable."
                    : "No matching members."
              }
            />
            {peopleState === "unavailable" && (
              <p className="text-xs text-ink-3">
                Workspace members are unavailable.
              </p>
            )}
          </div>
          <div className="grid gap-1 text-sm">
            <span>Folder</span>
            <Combobox
              aria-label="Folder"
              options={[
                { value: "", label: "Current location" },
                { value: "all", label: "All folders" },
                { value: "unfiled", label: "Unfiled" },
                ...folders.map((folder) => ({
                  value: folder.id,
                  label: folder.name,
                })),
              ]}
              value={draft.folder}
              onValueChange={(folder) => setDraft({ ...draft, folder })}
              searchPlaceholder="Search folders"
              emptyText="No matching folders."
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="grid gap-1 text-sm">
              Min size (MiB)
              <Input
                type="number"
                min="0"
                max="8589934591"
                step="any"
                value={draft.minSize}
                onChange={(event) =>
                  setDraft({ ...draft, minSize: event.target.value })
                }
              />
            </label>
            <label className="grid gap-1 text-sm">
              Max size (MiB)
              <Input
                type="number"
                min="0"
                max="8589934591"
                step="any"
                value={draft.maxSize}
                onChange={(event) =>
                  setDraft({ ...draft, maxSize: event.target.value })
                }
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <FileDateFilter
              label="Uploaded from"
              value={draft.uploadedFrom}
              onChange={(uploadedFrom) => setDraft({ ...draft, uploadedFrom })}
            />
            <FileDateFilter
              label="Uploaded through"
              value={draft.uploadedThrough}
              onChange={(uploadedThrough) =>
                setDraft({ ...draft, uploadedThrough })
              }
            />
          </div>
          {invalidSize || invalidDates ? (
            <p role="alert" className="text-xs text-destructive">
              {invalidSize
                ? "Minimum size must be at most the maximum."
                : "Start date must be on or before the end date."}
            </p>
          ) : null}
          <div className="flex justify-between">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                onChange(emptyFileFilters);
                setOpen(false);
              }}
            >
              Clear filters
            </Button>
            <Button type="submit" size="sm">
              Apply filters
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
