import { type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { paths } from "~/src/lib/paths";
import {
  holdsLabel,
  newId,
  touch,
  type Box,
  type El,
  type Point,
} from "../canvas/model";
import { topAt } from "../canvas/geometry";
import type { BoardStyle, Drag, Handle, Tool, View } from "./editor-types";
import { handlePointerDown } from "./use-board-pointer-down";
import { handlePointerMove } from "./use-board-pointer-move";
import { handlePointerUp } from "./use-board-pointer-up";

export function useBoardPointer({
  svgRef,
  zoomBy,
  setView,
  latest,
  setDrag,
  drag,
  editing,
  setEditing,
  toBoard,
  tool,
  setTool,
  space,
  presenting,
  canEdit,
  shown,
  withGroup,
  selected,
  setSelected,
  grid,
  style,
  viewerName,
  commit,
  replace,
  add,
  pointer,
  view,
  history,
  dirty,
  setSave,
  selectionBox,
  selection,
}: {
  svgRef: RefObject<SVGSVGElement | null>;
  zoomBy: (factor: number, at?: Point) => void;
  setView: React.Dispatch<React.SetStateAction<View>>;
  latest: RefObject<El[]>;
  setDrag: React.Dispatch<React.SetStateAction<Drag | null>>;
  drag: Drag | null;
  editing: { id: string; text: string } | null;
  setEditing: React.Dispatch<
    React.SetStateAction<{ id: string; text: string } | null>
  >;
  toBoard: (event: { clientX: number; clientY: number }) => Point;
  tool: Tool;
  setTool: (tool: Tool) => void;
  space: RefObject<boolean>;
  presenting: number | null;
  canEdit: boolean;
  shown: El[];
  withGroup: (el: El) => string[];
  selected: string[];
  setSelected: (ids: string[]) => void;
  grid: boolean;
  style: BoardStyle;
  viewerName: string;
  commit: (els: El[], record?: boolean) => void;
  replace: (els: El[]) => void;
  add: (els: El[]) => void;
  pointer: RefObject<{ x: number; y: number } | null>;
  view: View;
  history: RefObject<{ past: El[][]; future: El[][] }>;
  dirty: RefObject<boolean>;
  setSave: (save: "saved" | "saving" | "dirty" | "error") => void;
  selectionBox: Box | null;
  selection: El[];
}) {
  const router = useRouter();

  function onWheel(event: WheelEvent) {
    if (event.ctrlKey || event.metaKey) {
      const rect = svgRef.current!.getBoundingClientRect();
      zoomBy(event.deltaY < 0 ? 1.1 : 1 / 1.1, {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    } else {
      setView((v) => ({ ...v, x: v.x - event.deltaX, y: v.y - event.deltaY }));
    }
  }

  function onDown(event: ReactPointerEvent<SVGSVGElement>) {
    handlePointerDown({
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
    });
  }

  function onMove(event: ReactPointerEvent<SVGSVGElement>) {
    const p = toBoard(event);
    pointer.current = p;
    handlePointerMove({
      event,
      p,
      drag,
      setDrag,
      setView,
      grid,
      latest,
      commit,
    });
  }

  function onUp(event: ReactPointerEvent<SVGSVGElement>) {
    handlePointerUp({
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
    });
  }

  function onDoubleClick(event: React.MouseEvent<SVGSVGElement>) {
    if (!canEdit) return;
    const p = toBoard(event);
    const hit = topAt(shown, p, 8 / view.k);

    if (hit?.type === "task" && hit.taskKey) {
      router.push(paths.task(hit.taskKey));
      return;
    }

    if (hit && holdsLabel(hit)) {
      setSelected([hit.id]);
      setEditing({ id: hit.id, text: hit.text ?? "" });
      return;
    }

    if (!hit) {
      const text: El = {
        id: newId(),
        type: "text",
        x: p.x,
        y: p.y - 14,
        w: 240,
        h: 40,
        color: style.color,
        fontSize: style.fontSize,
        v: 1,
      };
      add([text]);
      setEditing({ id: text.id, text: "" });
    }
  }

  function finishEditing() {
    if (!editing) return;
    const el = latest.current.find((one) => one.id === editing.id);
    setEditing(null);
    if (!el) return;

    if ((el.type === "text" || el.type === "comment") && !editing.text.trim()) {
      replace([touch(el, { deleted: true })]);
      return;
    }

    if (el.text === editing.text) return;

    let change: Partial<El> = { text: editing.text };
    if (el.type === "text") {
      const lines = editing.text.split("\n").length;
      change = {
        ...change,
        h: Math.max(el.h, lines * (el.fontSize ?? 20) * 1.3 + 12),
      };
    }
    replace([touch(el, change)]);
  }

  function startResize(event: ReactPointerEvent, handle: Handle) {
    if (!selectionBox) return;
    event.stopPropagation();
    (event.target as Element).setPointerCapture?.(event.pointerId);
    history.current.past = [...history.current.past.slice(-99), latest.current];
    history.current.future = [];
    setDrag({
      kind: "resize",
      handle,
      box: selectionBox,
      originals: new Map(
        selection.filter((el) => !el.locked).map((el) => [el.id, el]),
      ),
    });
  }

  function startEndDrag(
    event: ReactPointerEvent,
    el: El,
    which: "start" | "end",
  ) {
    event.stopPropagation();
    (event.target as Element).setPointerCapture?.(event.pointerId);
    history.current.past = [...history.current.past.slice(-99), latest.current];
    history.current.future = [];
    setDrag({ kind: "end", id: el.id, which });
  }

  return {
    onWheel,
    onDown,
    onMove,
    onUp,
    onDoubleClick,
    finishEditing,
    startResize,
    startEndDrag,
  };
}
