import { useCallback, type RefObject } from "react";
import { rerouteAround } from "../canvas/geometry";
import {
  bounds,
  clamp,
  live,
  touch,
  union,
  type Box,
  type El,
  type Point,
} from "../canvas/model";
import type { View } from "./editor-types";

export function useBoardViewActions({
  view,
  setView,
  svgRef,
  latest,
  selection,
  selectionBox,
  selected,
  replace,
  commit,
}: {
  view: View;
  setView: React.Dispatch<React.SetStateAction<View>>;
  svgRef: RefObject<SVGSVGElement | null>;
  latest: RefObject<El[]>;
  selection: El[];
  selectionBox: Box | null;
  selected: string[];
  replace: (els: El[]) => void;
  commit: (els: El[], record?: boolean) => void;
}) {
  const toBoard = useCallback(
    (event: { clientX: number; clientY: number }): Point => {
      const rect = svgRef.current!.getBoundingClientRect();
      return {
        x: (event.clientX - rect.left - view.x) / view.k,
        y: (event.clientY - rect.top - view.y) / view.k,
      };
    },
    [view, svgRef],
  );

  const viewCentre = useCallback((): Point => {
    const rect = svgRef.current?.getBoundingClientRect();
    return rect
      ? {
          x: (rect.width / 2 - view.x) / view.k,
          y: (rect.height / 2 - view.y) / view.k,
        }
      : { x: 0, y: 0 };
  }, [view, svgRef]);

  const zoomBy = useCallback(
    (factor: number, at?: Point) => {
      setView((v) => {
        const rect = svgRef.current!.getBoundingClientRect();
        const px = at?.x ?? rect.width / 2;
        const py = at?.y ?? rect.height / 2;
        const k = clamp(v.k * factor, 0.1, 4);

        return {
          k,
          x: px - ((px - v.x) / v.k) * k,
          y: py - ((py - v.y) / v.k) * k,
        };
      });
    },
    [setView, svgRef],
  );

  const fit = useCallback(
    (box?: Box | null) => {
      const target = box ?? union(live(latest.current).map(bounds));
      const rect = svgRef.current?.getBoundingClientRect();
      if (!target || !rect) return;

      const k = clamp(
        Math.min(
          (rect.width - 80) / (target.w || 1),
          (rect.height - 80) / (target.h || 1),
        ),
        0.1,
        2,
      );

      setView({
        k,
        x: rect.width / 2 - (target.x + target.w / 2) * k,
        y: rect.height / 2 - (target.y + target.h / 2) * k,
      });
    },
    [latest, setView, svgRef],
  );

  const align = useCallback(
    (edge: "left" | "hcentre" | "right" | "top" | "vcentre" | "bottom") => {
      if (selection.length < 2 || !selectionBox) return;
      const box = selectionBox;

      replace(
        selection.map((el) => {
          const b = bounds(el);
          const dx =
            edge === "left"
              ? box.x - b.x
              : edge === "right"
                ? box.x + box.w - b.x - b.w
                : edge === "hcentre"
                  ? box.x + box.w / 2 - b.x - b.w / 2
                  : 0;
          const dy =
            edge === "top"
              ? box.y - b.y
              : edge === "bottom"
                ? box.y + box.h - b.y - b.h
                : edge === "vcentre"
                  ? box.y + box.h / 2 - b.y - b.h / 2
                  : 0;

          return touch(el, { x: el.x + dx, y: el.y + dy });
        }),
      );
      commit(rerouteAround(latest.current, new Set(selected)), false);
    },
    [selection, selectionBox, replace, commit, latest, selected],
  );

  return {
    toBoard,
    viewCentre,
    zoomBy,
    fit,
    align,
  };
}
