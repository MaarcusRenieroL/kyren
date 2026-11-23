import {
  MapIcon,
  MaximizeIcon,
  MinusIcon,
  PlusIcon,
  Redo2Icon,
  Undo2Icon,
} from "lucide-react";
import { Button } from "@zentro/ui/shadcn/button";
import type { El } from "../canvas/model";
import { Minimap } from "../canvas/minimap";
import type { View } from "./editor-types";

export function EditorFooterControls({
  view,
  setView,
  zoomBy,
  fit,
  setHelpOpen,
  showMap,
  setShowMap,
  canEdit,
  undo,
  redo,
  presenting,
  frames,
  present,
  shown,
  canvasSize,
}: {
  view: View;
  setView: React.Dispatch<React.SetStateAction<View>>;
  zoomBy: (factor: number) => void;
  fit: () => void;
  setHelpOpen: (open: boolean) => void;
  showMap: boolean;
  setShowMap: React.Dispatch<React.SetStateAction<boolean>>;
  canEdit: boolean;
  undo: () => void;
  redo: () => void;
  presenting: number | null;
  frames: El[];
  present: (index: number | null) => void;
  shown: El[];
  canvasSize: { w: number; h: number };
}) {
  return (
    <>
      {presenting !== null ? (
        <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-line bg-canvas px-3 py-2 text-sm shadow-lg">
          <Button
            size="sm"
            variant="ghost"
            disabled={presenting === 0}
            onClick={() => present(presenting - 1)}
          >
            Previous
          </Button>
          <span role="status">
            {frames[presenting]?.text || "Frame"} · {presenting + 1} of{" "}
            {frames.length}
          </span>
          <Button
            size="sm"
            variant="ghost"
            disabled={presenting >= frames.length - 1}
            onClick={() => present(presenting + 1)}
          >
            Next
          </Button>
          <Button size="sm" variant="outline" onClick={() => present(null)}>
            Stop presenting
          </Button>
        </div>
      ) : (
        <div className="absolute bottom-3 left-3 z-10 flex items-center gap-1 rounded-xl border border-line bg-canvas p-1 shadow-sm">
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Zoom out"
            onClick={() => zoomBy(1 / 1.2)}
          >
            <MinusIcon aria-hidden />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            aria-label="Reset zoom"
            onClick={() => setView((v) => ({ ...v, k: 1 }))}
          >
            {Math.round(view.k * 100)}%
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Zoom in"
            onClick={() => zoomBy(1.2)}
          >
            <PlusIcon aria-hidden />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Fit to screen"
            title="Fit to screen — Shift 1"
            onClick={() => fit()}
          >
            <MaximizeIcon aria-hidden />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            aria-label="Keyboard shortcuts"
            title="Keyboard shortcuts — ?"
            onClick={() => setHelpOpen(true)}
          >
            ?
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Board overview"
            aria-pressed={showMap}
            title="Board overview — M"
            onClick={() => setShowMap((value) => !value)}
          >
            <MapIcon aria-hidden />
          </Button>
          {canEdit ? (
            <>
              <span className="mx-1 h-5 w-px bg-line" aria-hidden />
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Undo"
                onClick={undo}
              >
                <Undo2Icon aria-hidden />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Redo"
                onClick={redo}
              >
                <Redo2Icon aria-hidden />
              </Button>
            </>
          ) : null}
        </div>
      )}

      {presenting === null && showMap && shown.length && canvasSize.w ? (
        <div className="absolute right-4 bottom-24 z-10">
          <Minimap
            shapes={shown}
            visible={{
              x: -view.x / view.k,
              y: -view.y / view.k,
              w: canvasSize.w / view.k,
              h: canvasSize.h / view.k,
            }}
            onCenter={(point) =>
              setView((v) => ({
                ...v,
                x: canvasSize.w / 2 - point.x * v.k,
                y: canvasSize.h / 2 - point.y * v.k,
              }))
            }
          />
        </div>
      ) : null}
    </>
  );
}
