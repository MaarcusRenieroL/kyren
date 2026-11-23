import { useEffect } from "react";
import { Textarea } from "@zentro/ui/shadcn/textarea";
import type { PointerEvent as ReactPointerEvent, RefObject } from "react";
import type { Box, El } from "../canvas/model";
import { Shape } from "../canvas/shape";
import { EditorCanvasOverlays } from "./editor-canvas-overlays";
import type { Drag, Handle, View } from "./editor-types";

export function EditorCanvas({
  id,
  svgRef,
  layerRef,
  view,
  grid,
  cursor,
  shown,
  statuses,
  editing,
  setEditing,
  editingEl,
  editingBox,
  finishEditing,
  presenting,
  selection,
  selectionBox,
  canEdit,
  linearSingle,
  openComment,
  allLocked,
  drag,
  startResize,
  startEndDrag,
  others,
  onDown,
  onMove,
  onUp,
  onWheel,
  onDoubleClick,
  pointerRef,
  setMenu,
}: {
  id: string;
  svgRef: RefObject<SVGSVGElement | null>;
  layerRef: RefObject<SVGGElement | null>;
  view: View;
  grid: boolean;
  cursor: string;
  shown: El[];
  statuses: Map<string, string>;
  editing: { id: string; text: string } | null;
  setEditing: React.Dispatch<
    React.SetStateAction<{ id: string; text: string } | null>
  >;
  editingEl: El | undefined;
  editingBox: Box | null;
  finishEditing: () => void;
  presenting: number | null;
  selection: El[];
  selectionBox: Box | null;
  canEdit: boolean;
  linearSingle: El | null;
  openComment: El | null;
  allLocked: boolean;
  drag: Drag | null;
  startResize: (event: ReactPointerEvent, handle: Handle) => void;
  startEndDrag: (
    event: ReactPointerEvent,
    el: El,
    which: "start" | "end",
  ) => void;
  others: any[];
  onDown: (event: ReactPointerEvent<SVGSVGElement>) => void;
  onMove: (event: ReactPointerEvent<SVGSVGElement>) => void;
  onUp: (event: ReactPointerEvent<SVGSVGElement>) => void;
  onWheel: (event: WheelEvent) => void;
  onDoubleClick: (event: React.MouseEvent<SVGSVGElement>) => void;
  pointerRef: RefObject<{ x: number; y: number } | null>;
  setMenu: (menu: any) => void;
}) {
  useEffect(() => {
    const canvas = svgRef.current;
    if (!canvas) return;
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      onWheel(event);
    };
    canvas.addEventListener("wheel", handleWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", handleWheel);
  }, [svgRef, onWheel]);

  return (
    <>
      <svg
        ref={svgRef}
        aria-label="Whiteboard canvas"
        role="application"
        className="size-full touch-none text-ink select-none"
        style={{ cursor }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onPointerLeave={() => {
          pointerRef.current = null;
        }}
        onDoubleClick={onDoubleClick}
        onClick={() => setMenu(null)}
      >
        <defs>
          <pattern
            id={`grid-${id}`}
            width={20 * view.k}
            height={20 * view.k}
            x={view.x}
            y={view.y}
            patternUnits="userSpaceOnUse"
          >
            <circle cx={1} cy={1} r={1} fill="currentColor" opacity={0.18} />
          </pattern>
        </defs>
        {grid ? (
          <rect width="100%" height="100%" fill={`url(#grid-${id})`} />
        ) : null}

        <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
          <g ref={layerRef}>
            {shown.map((el) => (
              <g key={el.id} data-testid={`shape-${el.type}`}>
                <Shape
                  el={el}
                  live={editing?.id === el.id ? "" : undefined}
                  status={el.taskKey ? statuses.get(el.taskKey) : undefined}
                />
              </g>
            ))}
          </g>

          {presenting === null ? (
            <EditorCanvasOverlays
              selection={selection}
              selectionBox={selectionBox}
              view={view}
              canEdit={canEdit}
              linearSingle={linearSingle}
              openComment={openComment}
              allLocked={allLocked}
              drag={drag}
              startResize={startResize}
              startEndDrag={startEndDrag}
              others={others}
            />
          ) : null}
        </g>
      </svg>

      {editing && editingEl && editingBox ? (
        <Textarea
          autoFocus
          aria-label="Shape text"
          value={editing.text}
          onChange={(event) =>
            setEditing({ id: editing.id, text: event.target.value })
          }
          onBlur={finishEditing}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (
              event.key === "Escape" ||
              (event.key === "Enter" && (event.metaKey || event.ctrlKey))
            ) {
              (event.target as HTMLTextAreaElement).blur();
            }
          }}
          className="absolute z-20 resize-none rounded border border-signal bg-canvas/90 p-2 text-ink outline-none"
          style={{
            left: view.x + editingBox.x * view.k,
            top: view.y + editingBox.y * view.k,
            width: Math.max(120, editingBox.w * view.k),
            height: Math.max(40, editingBox.h * view.k),
            fontSize: (editingEl.fontSize ?? 18) * view.k,
            lineHeight: 1.25,
            textAlign: editingEl.type === "text" ? "left" : "center",
          }}
        />
      ) : null}
    </>
  );
}
