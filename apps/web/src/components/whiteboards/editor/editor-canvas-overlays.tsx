import type { PointerEvent as ReactPointerEvent } from "react";
import { bounds, type Box, type El } from "../canvas/model";
import { wrap } from "../canvas/shape";
import { handles, type Drag, type Handle, type Other, type View } from "./editor-types";
import { handlePoint, personColour } from "./editor-geometry";

export function EditorCanvasOverlays({
  selection,
  selectionBox,
  view,
  canEdit,
  linearSingle,
  openComment,
  allLocked,
  drag,
  startResize,
  startEndDrag,
  others,
}: {
  selection: El[];
  selectionBox: Box | null;
  view: View;
  canEdit: boolean;
  linearSingle: El | null;
  openComment: El | null;
  allLocked: boolean;
  drag: Drag | null;
  startResize: (event: ReactPointerEvent, handle: Handle) => void;
  startEndDrag: (event: ReactPointerEvent, linear: El, which: "start" | "end") => void;
  others: Other[];
}) {
  return (
    <>
      <g aria-hidden>
        {selection.map((el) => {
          const b = bounds(el);
          return (
            <rect
              key={el.id}
              x={b.x - 4}
              y={b.y - 4}
              width={b.w + 8}
              height={b.h + 8}
              fill="none"
              stroke="var(--signal)"
              strokeWidth={1.5 / view.k}
              strokeDasharray={
                el.locked ? `${4 / view.k} ${3 / view.k}` : undefined
              }
              pointerEvents="none"
            />
          );
        })}
        {selectionBox && selection.length > 1 ? (
          <rect
            x={selectionBox.x - 8}
            y={selectionBox.y - 8}
            width={selectionBox.w + 16}
            height={selectionBox.h + 16}
            fill="none"
            stroke="var(--signal)"
            strokeWidth={1 / view.k}
            strokeDasharray={`${6 / view.k} ${4 / view.k}`}
            pointerEvents="none"
          />
        ) : null}
        {canEdit &&
        selectionBox &&
        !linearSingle &&
        !openComment &&
        !allLocked &&
        !drag
          ? handles.map((handle) => {
              const q = handlePoint(selectionBox, handle);
              const size = 10 / view.k;

              return (
                <rect
                  key={handle}
                  x={q.x - size / 2}
                  y={q.y - size / 2}
                  width={size}
                  height={size}
                  rx={2 / view.k}
                  fill="var(--canvas)"
                  stroke="var(--signal)"
                  strokeWidth={1.5 / view.k}
                  style={{ cursor: `${handle}-resize` }}
                  onPointerDown={(event) => startResize(event, handle)}
                />
              );
            })
          : null}
        {canEdit && linearSingle && !drag
          ? (["start", "end"] as const).map((which) => {
              const points = linearSingle.points ?? [];
              const q =
                which === "start"
                  ? {
                      x: linearSingle.x + (points[0] ?? 0),
                      y: linearSingle.y + (points[1] ?? 0),
                    }
                  : {
                      x:
                        linearSingle.x +
                        (points[points.length - 2] ?? 0),
                      y:
                        linearSingle.y +
                        (points[points.length - 1] ?? 0),
                    };

              return (
                <circle
                  key={which}
                  cx={q.x}
                  cy={q.y}
                  r={6 / view.k}
                  fill="var(--canvas)"
                  stroke="var(--signal)"
                  strokeWidth={1.5 / view.k}
                  style={{ cursor: "move" }}
                  onPointerDown={(event) =>
                    startEndDrag(event, linearSingle, which)
                  }
                />
              );
            })
          : null}
        {openComment ? (
          <g
            transform={`translate(${openComment.x + 36} ${openComment.y}) scale(${1 / view.k})`}
            pointerEvents="none"
          >
            <rect
              width={280}
              height={
                44 + wrap(openComment.text ?? "", 252, 14).length * 18
              }
              rx={10}
              fill="var(--canvas)"
              stroke="var(--line)"
            />
            <text
              x={14}
              y={22}
              fontSize={12}
              fontWeight={600}
              fill="currentColor"
            >
              {openComment.author ?? "Comment"}
            </text>
            {wrap(openComment.text ?? "", 252, 14).map((line, i) => (
              <text
                key={i}
                x={14}
                y={44 + i * 18}
                fontSize={14}
                fill="currentColor"
              >
                {line}
              </text>
            ))}
          </g>
        ) : null}
        {drag?.kind === "marquee" ? (
          <rect
            x={Math.min(drag.from.x, drag.to.x)}
            y={Math.min(drag.from.y, drag.to.y)}
            width={Math.abs(drag.to.x - drag.from.x)}
            height={Math.abs(drag.to.y - drag.from.y)}
            fill="var(--signal)"
            fillOpacity={0.08}
            stroke="var(--signal)"
            strokeWidth={1 / view.k}
            pointerEvents="none"
          />
        ) : null}
      </g>

      {others.map((other) =>
        other.cursor ? (
          <g
            key={other.id}
            aria-hidden
            pointerEvents="none"
            style={{
              transform: `translate(${other.cursor.x}px, ${other.cursor.y}px) scale(${1 / view.k})`,
              transition: "transform 1.4s linear",
            }}
          >
            <path
              d="M0 0 L0 16 L4.5 12 L8 19 L10.5 18 L7 11 L13 11 Z"
              fill={personColour(other.id)}
              stroke="white"
              strokeWidth={1.2}
            />
            <rect
              x={12}
              y={18}
              rx={6}
              height={20}
              width={other.name.length * 7 + 14}
              fill={personColour(other.id)}
            />
            <text x={19} y={32} fontSize={12} fill="white">
              {other.name}
            </text>
          </g>
        ) : null,
      )}
    </>
  );
}
