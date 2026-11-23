import type { PointerEvent as ReactPointerEvent, RefObject } from "react";
import {
  bounds,
  contains,
  defaults,
  isLinear,
  live,
  newId,
  snap,
  topZ,
  type El,
  type Kind,
  type Point,
} from "../canvas/model";
import { topAt } from "../canvas/geometry";
import type { BoardStyle, Drag, Tool, View } from "./editor-types";

export function startMove({
  from,
  ids,
  latest,
  history,
  setDrag,
}: {
  from: Point;
  ids: string[];
  latest: RefObject<El[]>;
  history: RefObject<{ past: El[][]; future: El[][] }>;
  setDrag: React.Dispatch<React.SetStateAction<Drag | null>>;
}) {
  const all = live(latest.current);
  const moving = new Map<string, El>();

  for (const el of all) {
    if (ids.includes(el.id) && !el.locked) moving.set(el.id, el);
  }

  for (const frame of [...moving.values()].filter((el) => el.type === "frame")) {
    const box = bounds(frame);
    for (const el of all) {
      if (!el.locked && el.id !== frame.id && contains(box, bounds(el))) {
        moving.set(el.id, el);
      }
    }
  }

  history.current.past = [...history.current.past.slice(-99), latest.current];
  history.current.future = [];
  setDrag({ kind: "move", from, originals: moving });
}

export function handlePointerDown({
  event,
  editing,
  toBoard,
  tool,
  space,
  presenting,
  setDrag,
  view,
  canEdit,
  shown,
  withGroup,
  selected,
  setSelected,
  latest,
  history,
  grid,
  style,
  viewerName,
  commit,
}: {
  event: ReactPointerEvent<SVGSVGElement>;
  editing: { id: string; text: string } | null;
  toBoard: (event: { clientX: number; clientY: number }) => Point;
  tool: Tool;
  space: RefObject<boolean>;
  presenting: number | null;
  setDrag: React.Dispatch<React.SetStateAction<Drag | null>>;
  view: View;
  canEdit: boolean;
  shown: El[];
  withGroup: (el: El) => string[];
  selected: string[];
  setSelected: (ids: string[]) => void;
  latest: RefObject<El[]>;
  history: RefObject<{ past: El[][]; future: El[][] }>;
  grid: boolean;
  style: BoardStyle;
  viewerName: string;
  commit: (els: El[], record?: boolean) => void;
}) {
  if (editing) return;
  (event.target as Element).setPointerCapture?.(event.pointerId);
  const p = toBoard(event);

  if (
    tool === "hand" ||
    space.current ||
    event.button === 1 ||
    presenting !== null
  ) {
    setDrag({
      kind: "pan",
      sx: event.clientX,
      sy: event.clientY,
      vx: view.x,
      vy: view.y,
    });
    return;
  }

  if (!canEdit) return;

  if (tool === "select") {
    const hit = topAt(shown, p, 8 / view.k);
    if (hit) {
      const ids = withGroup(hit);
      const next = event.shiftKey
        ? selected.includes(hit.id)
          ? selected.filter((one) => !ids.includes(one))
          : [...selected, ...ids]
        : selected.includes(hit.id)
          ? selected
          : ids;

      setSelected(next);
      startMove({ from: p, ids: next, latest, history, setDrag });
    } else {
      if (!event.shiftKey) setSelected([]);
      setDrag({ kind: "marquee", from: p, to: p, additive: event.shiftKey });
    }
    return;
  }

  const x = snap(p.x, grid);
  const y = snap(p.y, grid);
  const elId = newId();
  const base: El = {
    id: elId,
    type: tool as Kind,
    x,
    y,
    w: 0,
    h: 0,
    color: style.color,
    fill: style.fill,
    strokeWidth: style.strokeWidth,
    dash: style.dash,
    sketch: style.sketch,
    fontSize: style.fontSize,
    v: 1,
    z: topZ(latest.current),
    ...defaults(tool as Kind, style.color),
    ...(tool === "comment" ? { author: viewerName } : {}),
  };

  history.current.past = [...history.current.past.slice(-99), latest.current];
  history.current.future = [];

  if (tool === "pen") {
    commit([...latest.current, { ...base, points: [0, 0] }], false);
    setDrag({ kind: "pen", id: elId });
    return;
  }

  if (tool === "line" || tool === "arrow") {
    const from = topAt(
      shown.filter((el) => !isLinear(el)),
      p,
      4 / view.k,
    );

    commit(
      [
        ...latest.current,
        {
          ...base,
          fill: undefined,
          points: [0, 0, 0, 0],
          start: from ? { id: from.id } : undefined,
        },
      ],
      false,
    );
    setDrag({ kind: "end", id: elId, which: "end" });
    return;
  }

  commit([...latest.current, base], false);
  setDrag({ kind: "draw", id: elId, from: { x, y } });
}
