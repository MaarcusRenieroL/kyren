import Link from "next/link";
import { ArrowLeftIcon, PresentationIcon } from "lucide-react";
import { Button } from "@zentro/ui/shadcn/button";
import type { El } from "../canvas/model";
import type { Other, SaveState } from "./editor-types";

export function EditorHeader({
  title,
  canEdit,
  save,
  others,
  frames,
  onPresent,
}: {
  title: string;
  canEdit: boolean;
  save: SaveState;
  others: Other[];
  frames: El[];
  onPresent: (index: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2">
      <Button asChild variant="ghost" size="icon-sm">
        <Link href="/whiteboards" aria-label="Back to boards">
          <ArrowLeftIcon aria-hidden />
        </Link>
      </Button>
      <h1 className="truncate text-sm font-semibold">{title}</h1>
      <span role="status" className="text-xs text-ink-3">
        {!canEdit
          ? "View only"
          : save === "saving"
            ? "Saving…"
            : save === "dirty"
              ? "Unsaved changes"
              : save === "error"
                ? "Could not save — retrying"
                : "Saved"}
      </span>
      <div className="ml-auto flex items-center gap-2">
        {others.length ? (
          <div
            className="flex -space-x-2"
            aria-label={`Also here: ${others.map((o) => o.name).join(", ")}`}
          >
            {others.slice(0, 5).map((other) => (
              <span
                key={other.id}
                title={other.name}
                className="flex size-7 items-center justify-center rounded-full border-2 border-canvas bg-tint-lilac text-[11px] font-semibold text-ink"
              >
                {other.name.slice(0, 2).toUpperCase()}
              </span>
            ))}
          </div>
        ) : null}
        {frames.length ? (
          <Button variant="outline" size="sm" onClick={() => onPresent(0)}>
            <PresentationIcon aria-hidden />
            Present
          </Button>
        ) : null}
      </div>
    </div>
  );
}
