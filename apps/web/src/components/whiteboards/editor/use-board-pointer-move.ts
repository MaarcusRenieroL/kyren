import type { PointerEvent as ReactPointerEvent, RefObject } from "react";
import { snap, touch, type El, type Point } from "../canvas/model";
import { rerouteAround, scaleInto } from "../canvas/geometry";
import { resized } from "./editor-geometry";
import type { Drag, View } from "./editor-types";

export function handlePointerMove({
  event,
  p,
  drag,
  setDrag,
  setView,
  grid,
  latest,
  commit,
}: {
  event: ReactPointerEvent<SVGSVGElement>;
  p: Point;
  drag: Drag | null;
  setDrag: React.Dispatch<React.SetStateAction<Drag | null>>;
  setView: React.Dispatch<React.SetStateAction<View>>;
  grid: boolean;
  latest: RefObject<El[]>;
  commit: (els: El[], record?: boolean) => void;
}) {
  if (!drag) return;

  if (drag.kind === "pan") {
    setView((v) => ({
      ...v,
      x: drag.vx + event.clientX - drag.sx,
      y: drag.vy + event.clientY - drag.sy,
    }));
    return;
  }

  if (drag.kind === "marquee") {
    setDrag({ ...drag, to: p });
    return;
  }

  if (drag.kind === "move") {
    const dx = snap(p.x - drag.from.x, grid, grid ? 10 : 1);
    const dy = snap(p.y - drag.from.y, grid, grid ? 10 : 1);
    const moved = [...drag.originals.values()].map((el) =>
      touch(el, { x: el.x + dx, y: el.y + dy }),
    );
    const map = new Map(moved.map((el) => [el.id, el]));

    commit(
      rerouteAround(
        latest.current.map((el) => map.get(el.id) ?? el),
        new Set(map.keys()),
      ),
      false,
    );
    return;
  }

  if (drag.kind === "resize") {
    const to = resized(
      drag.box,
      drag.handle,
      { x: snap(p.x, grid, 10), y: snap(p.y, grid, 10) },
      event.shiftKey,
    );
    const changed = [...drag.originals.values()].map((el) =>
      scaleInto(el, drag.box, to),
    );
    const map = new Map(changed.map((el) => [el.id, el]));

    commit(
      rerouteAround(
        latest.current.map((el) => map.get(el.id) ?? el),
        new Set(map.keys()),
      ),
      false,
    );
    return;
  }

  if (drag.kind === "pen") {
    const el = latest.current.find((one) => one.id === drag.id);
    if (!el) return;

    commit(
      latest.current.map((one) =>
        one.id === drag.id
          ? {
              ...one,
              points: [...(one.points ?? []), p.x - one.x, p.y - one.y],
            }
          : one,
      ),
      false,
    );
    return;
  }

  if (drag.kind === "end") {
    const el = latest.current.find((one) => one.id === drag.id);
    if (!el) return;

    const points = [...(el.points ?? [0, 0, 0, 0])];
    const target = {
      x: snap(p.x, grid, 10) - el.x,
      y: snap(p.y, grid, 10) - el.y,
    };

    if (drag.which === "end") {
      points.splice(points.length - 2, 2, target.x, target.y);
    } else {
      points.splice(0, 2, target.x, target.y);
    }

    commit(
      latest.current.map((one) =>
        one.id === drag.id
          ? touch(one, {
              points: el.elbow
                ? [
                    points[0]!,
                    points[1]!,
                    points[points.length - 2]!,
                    points[points.length - 1]!,
                  ]
                : points,
            })
          : one,
      ),
      false,
    );
    return;
  }

  if (drag.kind === "draw") {
    const to = { x: snap(p.x, grid), y: snap(p.y, grid) };
    let w = Math.abs(to.x - drag.from.x);
    let h = Math.abs(to.y - drag.from.y);
    if (event.shiftKey) w = h = Math.max(w, h);

    commit(
      latest.current.map((one) =>
        one.id === drag.id
          ? {
              ...one,
              x: to.x < drag.from.x ? drag.from.x - w : drag.from.x,
              y: to.y < drag.from.y ? drag.from.y - h : drag.from.y,
              w,
              h,
            }
          : one,
      ),
      false,
    );
  }
}
