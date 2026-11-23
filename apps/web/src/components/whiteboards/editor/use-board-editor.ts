import { useMemo, useRef, useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { usePageCrumb } from "~/src/components/shell/breadcrumb-context";
import {
  bounds,
  isLinear,
  live,
  palette,
  union,
  type Dash,
  type El,
} from "../canvas/model";
import type { BoardStyle, Drag, Tool, View } from "./editor-types";
import { useBoardSync } from "./use-board-sync";
import { useBoardMutations } from "./use-board-mutations";
import { useBoardHotkeys } from "./use-board-hotkeys";
import { useBoardPointer } from "./use-board-pointer";

export function useBoardEditor({ id }: { id: string }) {
  const { resolvedTheme } = useTheme();
  const svgRef = useRef<SVGSVGElement>(null);
  const layerRef = useRef<SVGGElement>(null);
  const [elements, setElements] = useState<El[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [tool, setTool] = useState<Tool>("select");
  const [view, setView] = useState<View>({ x: 0, y: 0, k: 1 });
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [grid, setGrid] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const [menu, setMenu] = useState<"templates" | "export" | null>(null);
  const [presenting, setPresenting] = useState<number | null>(null);
  const [showMap, setShowMap] = useState(true);
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });

  const [style, setStyle] = useState<BoardStyle>({
    color: palette[0] as string,
    fill: "none" as string,
    strokeWidth: 2,
    dash: "solid" as Dash,
    sketch: false,
    fontSize: 18,
  });

  const latest = useRef<El[]>([]);
  latest.current = elements;
  const remote = useRef(new Map<string, number>());
  const space = useRef(false);

  const shown = useMemo(() => live(elements), [elements]);
  const byId = useMemo(() => new Map(elements.map((el) => [el.id, el])), [elements]);
  const selection = useMemo(
    () => shown.filter((el) => selected.includes(el.id)),
    [shown, selected],
  );
  const selectionBox = useMemo(() => union(selection.map(bounds)), [selection]);

  const {
    title,
    state,
    canEdit,
    viewerName,
    save,
    setSave,
    others,
    statuses,
    dirty,
    pointer,
  } = useBoardSync({
    id,
    elements,
    setElements,
    selected,
    editing,
    drag,
    latest,
    setView,
    svgRef,
  });

  usePageCrumb(`/whiteboards/${id}`, title);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) {
        setCanvasSize({
          w: entry.contentRect.width,
          h: entry.contentRect.height,
        });
      }
    });
    observer.observe(svg);
    return () => observer.disconnect();
  }, [state]);

  const mutations = useBoardMutations({
    latest,
    setElements,
    selected,
    setSelected,
    selection,
    selectionBox,
    view,
    setView,
    svgRef,
    layerRef,
    dirty,
    setSave,
    remote,
    setStyle,
    setPicking,
    setTool,
    setMenu,
    resolvedTheme,
    title,
  });

  const frames = useMemo(
    () =>
      shown
        .filter((el) => el.type === "frame")
        .sort((a, b) => a.y - b.y || a.x - b.x),
    [shown],
  );

  const present = (index: number | null) => {
    setPresenting(index);
    setSelected([]);
    if (index !== null && frames[index]) mutations.fit(bounds(frames[index]));
  };

  const history = useRef<{ past: El[][]; future: El[][] }>({
    past: [],
    future: [],
  });

  useBoardHotkeys({
    canEdit,
    presenting,
    frames,
    present,
    setHelpOpen,
    setShowMap,
    space,
    zoomBy: mutations.zoomBy,
    fit: mutations.fit,
    undo: mutations.undo,
    redo: mutations.redo,
    shown,
    selected,
    setSelected,
    selection,
    copy: mutations.copy,
    removeSelected: mutations.removeSelected,
    paste: mutations.paste,
    group: mutations.group,
    lock: mutations.lock,
    restack: mutations.restack,
    setTool,
    setEditing,
    replace: mutations.replace,
    commit: mutations.commit,
    latest,
    addImage: mutations.addImage,
  });

  const pointerHandlers = useBoardPointer({
    svgRef,
    zoomBy: mutations.zoomBy,
    setView,
    latest,
    setDrag,
    drag,
    editing,
    setEditing,
    toBoard: mutations.toBoard,
    tool,
    setTool,
    space,
    presenting,
    canEdit,
    shown,
    withGroup: mutations.withGroup,
    selected,
    setSelected,
    grid,
    style,
    viewerName,
    commit: mutations.commit,
    replace: mutations.replace,
    add: mutations.add,
    pointer,
    view,
    history,
    dirty,
    setSave,
    selectionBox,
    selection,
  });

  const single = selection.length === 1 ? selection[0]! : null;
  const linearSingle =
    single && isLinear(single) && single.type !== "pen" ? single : null;
  const editingEl = editing ? byId.get(editing.id) : undefined;
  const editingBox = editingEl
    ? editingEl.type === "comment"
      ? { x: editingEl.x + 36, y: editingEl.y, w: 260, h: 110 }
      : bounds(editingEl)
    : null;
  const openComment = single?.type === "comment" && !editing ? single : null;
  const cursor =
    tool === "hand" || drag?.kind === "pan"
      ? "grab"
      : tool === "select"
        ? "default"
        : "crosshair";
  const showStyle =
    canEdit && (selection.length > 0 || !["select", "hand"].includes(tool));
  const allLocked = selection.length > 0 && selection.every((el) => el.locked);

  return {
    svgRef,
    layerRef,
    state,
    title,
    canEdit,
    save,
    others,
    frames,
    present,
    presenting,
    tool,
    setTool,
    grid,
    setGrid,
    menu,
    setMenu,
    picking,
    setPicking,
    addTask: mutations.addTask,
    addImage: mutations.addImage,
    addTemplate: mutations.addTemplate,
    exportBoard: mutations.exportBoard,
    showStyle,
    style,
    single,
    linearSingle,
    selection,
    selectionBox,
    allLocked,
    restyle: mutations.restyle,
    replace: mutations.replace,
    restack: mutations.restack,
    copy: mutations.copy,
    paste: mutations.paste,
    lock: mutations.lock,
    removeSelected: mutations.removeSelected,
    align: mutations.align,
    group: mutations.group,
    undo: mutations.undo,
    redo: mutations.redo,
    fit: mutations.fit,
    zoomBy: mutations.zoomBy,
    view,
    setView,
    cursor,
    shown,
    statuses,
    editing,
    setEditing,
    editingEl,
    editingBox,
    openComment,
    drag,
    startResize: pointerHandlers.startResize,
    startEndDrag: pointerHandlers.startEndDrag,
    onDown: pointerHandlers.onDown,
    onMove: pointerHandlers.onMove,
    onUp: pointerHandlers.onUp,
    onWheel: pointerHandlers.onWheel,
    onDoubleClick: pointerHandlers.onDoubleClick,
    finishEditing: pointerHandlers.finishEditing,
    pointer,
    latest,
    helpOpen,
    setHelpOpen,
    showMap,
    setShowMap,
    canvasSize,
  };
}
