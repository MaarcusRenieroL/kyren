import type { PointerEvent as ReactPointerEvent, RefObject } from "react";
import {
  bounds,
  contains,
  isLinear,
  live,
  touch,
  type Box,
  type El,
  type Point,
} from "../canvas/model";
import { route } from "../canvas/geometry";
import type { Drag, Tool, View } from "./editor-types";

export function handlePointerUp({
  event,
  drag,
  setDrag,
  shown,
  selected,
  setSelected,
  withGroup,
  latest,
  history,
  dirty,
  setSave,
  toBoard,
  view,
  commit,
  setTool,
  setEditing,
}: {
  event: ReactPointerEvent<SVGSVGElement>;
  drag: Drag | null;
  setDrag: React.Dispatch<React.SetStateAction<Drag | null>>;
  shown: El[];
  selected: string[];
  setSelected: (ids: string[]) => void;
  withGroup: (el: El) => string[];
  latest: RefObject<El[]>;
  history: RefObject<{ past: El[][]; future: El[][] }>;
  dirty: RefObject<boolean>;
  setSave: (save: "saved" | "saving" | "dirty" | "error") => void;
  toBoard: (event: { clientX: number; clientY: number }) => Point;
  view: View;
  commit: (els: El[], record?: boolean) => void;
  setTool: (tool: Tool) => void;
  setEditing: React.Dispatch<React.SetStateAction<{ id: string; text: string } | null>>;
}) {
  if (!drag) return;
  const finished = drag;
  setDrag(null);

  if (finished.kind === "pan") return;

  if (finished.kind === "marquee") {
    const area: Box = {
      x: Math.min(finished.from.x, finished.to.x),
      y: Math.min(finished.from.y, finished.to.y),
      w: Math.abs(finished.to.x - finished.from.x),
      h: Math.abs(finished.to.y - finished.from.y),
    };

    if (area.w > 2 || area.h > 2) {
      const inside = shown
        .filter((el) => contains(area, bounds(el)))
        .flatMap((el) => withGroup(el));

      setSelected(
        finished.additive
          ? [...new Set([...selected, ...inside])]
          : [...new Set(inside)],
      );
    }
    return;
  }

  if (finished.kind === "move" || finished.kind === "resize") {
    const unchanged = [...finished.originals.values()].every(
      (el) => latest.current.find((one) => one.id === el.id)?.v === el.v,
    );

    if (unchanged) history.current.past.pop();
    else {
      dirty.current = true;
      setSave("dirty");
    }
    return;
  }

  const el = latest.current.find((one) => one.id === finished.id);
  if (!el) return;

  if (finished.kind === "end") {
    const p = toBoard(event);
    const over = topAtLinear(
      live(latest.current).filter(
        (one) => !isLinear(one) && one.id !== el.id,
      ),
      p,
      4 / view.k,
    );
    const linked = touch(
      el,
      finished.which === "end"
        ? { end: over ? { id: over.id } : undefined }
        : { start: over ? { id: over.id } : undefined },
    );
    const routed = route(
      linked,
      new Map(latest.current.map((one) => [one.id, one])),
    );
    const box = bounds(routed);

    if (box.w < 3 && box.h < 3 && !routed.start && !routed.end) {
      commit(
        latest.current.filter((one) => one.id !== el.id),
        false,
      );
      history.current.past.pop();
    } else {
      commit(
        latest.current.map((one) => (one.id === el.id ? routed : one)),
        false,
      );
      setSelected([el.id]);
    }

    setTool("select");
    dirty.current = true;
    setSave("dirty");
    return;
  }

  if (finished.kind === "pen") {
    dirty.current = true;
    setSave("dirty");
    return;
  }

  let sized = el;
  if (el.w < 8 && el.h < 8) {
    const size =
      el.type === "comment"
        ? { w: 28, h: 28 }
        : el.type === "sticky"
          ? { w: 200, h: 140 }
          : el.type === "text"
            ? { w: 240, h: 40 }
            : el.type === "frame"
              ? { w: 480, h: 320 }
              : { w: 160, h: 100 };
    sized = { ...el, ...size };
  }

  commit(
    latest.current.map((one) => (one.id === el.id ? sized : one)),
    false,
  );
  dirty.current = true;
  setSave("dirty");
  setSelected([el.id]);
  setTool("select");

  if (el.type === "text" || el.type === "sticky" || el.type === "comment") {
    setEditing({ id: el.id, text: "" });
  }
}

function topAtLinear(elements: El[], p: Point, tolerance: number): El | null {
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i];
    if (!el) continue;
    const b = bounds(el);
    if (
      p.x >= b.x - tolerance &&
      p.x <= b.x + b.w + tolerance &&
      p.y >= b.y - tolerance &&
      p.y <= b.y + b.h + tolerance
    ) {
      return el;
    }
  }
  return null;
}
