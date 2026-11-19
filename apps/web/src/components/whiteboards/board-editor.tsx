"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  AlignCenterHorizontalIcon,
  AlignEndHorizontalIcon,
  AlignStartHorizontalIcon,
  AlignStartVerticalIcon,
  AlignCenterVerticalIcon,
  AlignEndVerticalIcon,
  ArrowLeftIcon,
  ArrowUpRightIcon,
  BringToFrontIcon,
  CheckSquareIcon,
  CircleIcon,
  CopyIcon,
  DiamondIcon,
  DownloadIcon,
  FrameIcon,
  Grid3x3Icon,
  GroupIcon,
  HandIcon,
  ImageIcon,
  LayoutTemplateIcon,
  LockIcon,
  MessageSquareIcon,
  MaximizeIcon,
  MinusIcon,
  MousePointer2Icon,
  PencilIcon,
  PlusIcon,
  MapIcon,
  PresentationIcon,
  Redo2Icon,
  SendToBackIcon,
  SquareIcon,
  StickyNoteIcon,
  Trash2Icon,
  TypeIcon,
  Undo2Icon,
  UngroupIcon,
  UnlockIcon,
} from "lucide-react";

import { useTrpcClient } from "@zentro/api/react";
import { toast, toastError } from "@zentro/ui/index";
import { Button } from "@zentro/ui/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@zentro/ui/shadcn/dialog";

import { usePageCrumb } from "~/src/components/shell/breadcrumb-context";
import { boardTheme } from "@zentro/ui/lib/theme-colors";

import { apiPath, paths } from "~/src/lib/paths";

import { boardPng, boardSvg, download } from "./canvas/export";
import { rerouteAround, route, scaleInto, topAt } from "./canvas/geometry";
import {
  bounds,
  clamp,
  contains,
  defaults,
  fills,
  holdsLabel,
  isLinear,
  live,
  newId,
  palette,
  snap,
  stickyColors,
  topZ,
  touch,
  union,
  type Box,
  type Dash,
  type El,
  type Kind,
  type Point,
} from "./canvas/model";
import { Shape, wrap } from "./canvas/shape";
import { Minimap } from "./canvas/minimap";
import { mergeIn, restore } from "./canvas/sync";
import { TaskPicker, type PickedTask } from "./canvas/task-picker";
import { templates } from "./canvas/templates";

type Tool =
  | "select"
  | "hand"
  | "rect"
  | "ellipse"
  | "diamond"
  | "line"
  | "arrow"
  | "pen"
  | "text"
  | "sticky"
  | "frame"
  | "comment";
type View = { x: number; y: number; k: number };
type Handle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";
type Drag =
  | { kind: "pan"; sx: number; sy: number; vx: number; vy: number }
  | { kind: "marquee"; from: Point; to: Point; additive: boolean }
  | { kind: "move"; from: Point; originals: Map<string, El> }
  | { kind: "resize"; handle: Handle; box: Box; originals: Map<string, El> }
  | { kind: "end"; id: string; which: "start" | "end" }
  | { kind: "draw"; id: string; from: Point }
  | { kind: "pen"; id: string };
type SaveState = "saved" | "saving" | "dirty" | "error";

const tools: {
  id: Tool;
  label: string;
  key: string;
  icon: typeof PencilIcon;
}[] = [
  { id: "select", label: "Select", key: "v", icon: MousePointer2Icon },
  { id: "hand", label: "Pan", key: "h", icon: HandIcon },
  { id: "rect", label: "Rectangle", key: "r", icon: SquareIcon },
  { id: "ellipse", label: "Ellipse", key: "o", icon: CircleIcon },
  { id: "diamond", label: "Diamond", key: "d", icon: DiamondIcon },
  { id: "arrow", label: "Arrow", key: "a", icon: ArrowUpRightIcon },
  { id: "line", label: "Line", key: "l", icon: MinusIcon },
  { id: "pen", label: "Pen", key: "p", icon: PencilIcon },
  { id: "text", label: "Text", key: "t", icon: TypeIcon },
  { id: "sticky", label: "Sticky note", key: "s", icon: StickyNoteIcon },
  { id: "frame", label: "Frame", key: "f", icon: FrameIcon },
  { id: "comment", label: "Comment", key: "c", icon: MessageSquareIcon },
];

const handles: Handle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
const POLL_MS = 3000;
/** How often this editor shares where its pointer is and sees others'. */
const PRESENCE_MS = 1500;

type Other = {
  id: string;
  name: string;
  cursor: { x: number; y: number } | null;
};

/** A steady colour per person, from the board palette. */
function personColour(id: string) {
  let hash = 0;

  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) | 0;

  return palette[1 + (Math.abs(hash) % (palette.length - 1))]!;
}

const shortcuts: [string, string][] = [
  ["V / H", "Select / pan (or hold Space)"],
  ["R O D", "Rectangle, ellipse, diamond"],
  ["A L P", "Arrow, line, pen"],
  ["T S F", "Text, sticky note, frame"],
  ["C", "Pin a comment"],
  ["Double-click", "Write on empty space, or edit a shape's text"],
  ["Shift + drag", "Keep proportions while drawing or resizing"],
  ["Ctrl/⌘ Z, Shift Z", "Undo, redo"],
  ["Ctrl/⌘ C, X, V, D", "Copy, cut, paste, duplicate"],
  ["Ctrl/⌘ A", "Select everything"],
  ["Ctrl/⌘ G, Shift G", "Group, ungroup"],
  ["Ctrl/⌘ Shift L", "Lock or unlock"],
  ["[ and ]", "Send to back, bring to front"],
  ["Arrow keys", "Nudge (Shift: 10 px)"],
  ["Enter", "Edit the selected shape's text"],
  ["Ctrl/⌘ + / −, Shift 1", "Zoom in, out, fit everything"],
  ["Delete", "Delete the selection"],
  ["M", "Show or hide the board overview"],
  ["?", "This list"],
];

function handlePoint(box: Box, handle: Handle): Point {
  const x = handle.includes("w")
    ? box.x
    : handle.includes("e")
      ? box.x + box.w
      : box.x + box.w / 2;
  const y = handle.includes("n")
    ? box.y
    : handle.includes("s")
      ? box.y + box.h
      : box.y + box.h / 2;

  return { x, y };
}

/** The box after dragging `handle` to `p`. Shift keeps the proportions. */
function resized(box: Box, handle: Handle, p: Point, keepRatio: boolean): Box {
  let left = box.x;
  let top = box.y;
  let right = box.x + box.w;
  let bottom = box.y + box.h;

  if (handle.includes("w")) left = Math.min(p.x, right - 4);
  if (handle.includes("e")) right = Math.max(p.x, left + 4);
  if (handle.includes("n")) top = Math.min(p.y, bottom - 4);
  if (handle.includes("s")) bottom = Math.max(p.y, top + 4);

  let w = right - left;
  let h = bottom - top;

  if (keepRatio && box.w && box.h) {
    const ratio = box.w / box.h;

    if (w / h > ratio) w = h * ratio;
    else h = w / ratio;
    if (handle.includes("w")) left = right - w;
    if (handle.includes("n")) top = bottom - h;
  }

  return { x: left, y: top, w, h };
}

export function BoardEditor({ id }: { id: string }) {
  const trpc = useTrpcClient();
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const svgRef = useRef<SVGSVGElement>(null);
  const layerRef = useRef<SVGGElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "missing">(
    "loading",
  );
  const [canEdit, setCanEdit] = useState(false);
  const [elements, setElements] = useState<El[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [tool, setTool] = useState<Tool>("select");
  const [view, setView] = useState<View>({ x: 0, y: 0, k: 1 });
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(
    null,
  );
  const [drag, setDrag] = useState<Drag | null>(null);
  const [grid, setGrid] = useState(true);
  const [save, setSave] = useState<SaveState>("saved");
  const [others, setOthers] = useState<Other[]>([]);
  const [helpOpen, setHelpOpen] = useState(false);
  /** The viewer's own name, signed on the comments they pin. */
  const [viewerName, setViewerName] = useState("");
  /** This person's pointer on the board, shared with the others. */
  const pointer = useRef<Point | null>(null);
  const [statuses, setStatuses] = useState<Map<string, string>>(new Map());
  const [picking, setPicking] = useState(false);
  const [menu, setMenu] = useState<"templates" | "export" | null>(null);
  const [presenting, setPresenting] = useState<number | null>(null);
  const [style, setStyle] = useState({
    color: palette[0] as string,
    fill: "none" as string,
    strokeWidth: 2,
    dash: "solid" as Dash,
    sketch: false,
    fontSize: 18,
  });
  const latest = useRef<El[]>([]);
  const dirty = useRef(false);
  const inFlight = useRef(false);
  const history = useRef<{ past: El[][]; future: El[][] }>({
    past: [],
    future: [],
  });
  const clipboard = useRef<El[]>([]);
  /** When the board had last changed as of the last download. */
  const seen = useRef<string | null>(null);
  /** Shapes whose current copy came from the server (id → version). */
  const remote = useRef(new Map<string, number>());
  const space = useRef(false);

  latest.current = elements;
  usePageCrumb(`/whiteboards/${id}`, title);

  const shown = useMemo(() => live(elements), [elements]);
  const [showMap, setShowMap] = useState(true);
  /** The canvas's size on screen, for the overview's "you are here" box. */
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });

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
  const byId = useMemo(
    () => new Map(elements.map((el) => [el.id, el])),
    [elements],
  );
  const selection = useMemo(
    () => shown.filter((el) => selected.includes(el.id)),
    [shown, selected],
  );
  const selectionBox = useMemo(() => union(selection.map(bounds)), [selection]);

  // ---- loading, saving and staying in step with others ----

  useEffect(() => {
    let cancelled = false;

    trpc.whiteboard.get
      .query({ id })
      .then((board) => {
        if (cancelled) return;
        setTitle(board.title);
        setCanEdit(board.canEdit);
        setViewerName(board.viewerName);
        seen.current = board.updatedAt;
        setElements(board.elements as El[]);
        setState("ready");

        const box = union(live(board.elements as El[]).map(bounds));
        const rect = svgRef.current?.getBoundingClientRect();

        if (box && rect) {
          const k = clamp(
            Math.min((rect.width - 120) / box.w, (rect.height - 160) / box.h),
            0.2,
            1,
          );

          setView({
            k,
            x: rect.width / 2 - (box.x + box.w / 2) * k,
            y: rect.height / 2 - (box.y + box.h / 2) * k,
          });
        }
      })
      .catch(() => !cancelled && setState("missing"));

    return () => {
      cancelled = true;
    };
  }, [trpc, id]);

  /**
   * Shapes being dragged or typed in now: a remote copy must not jump them.
   * Read through a ref, so a drag doesn't restart the sync timers.
   */
  const busyIds = useRef(() => new Set<string>());

  busyIds.current = () => {
    const ids = new Set<string>(editing ? [editing.id] : []);

    if (drag) selected.forEach((one) => ids.add(one));

    return ids;
  };

  const busy = useCallback(() => busyIds.current(), []);

  const flush = useCallback(async () => {
    if (!dirty.current || inFlight.current) return;

    inFlight.current = true;
    dirty.current = false;
    setSave("saving");

    try {
      const { elements: merged, savedAt } = await trpc.whiteboard.save.mutate({
        id,
        elements: latest.current as never,
      });

      // The save returns everyone's shapes as of now.
      seen.current = savedAt;

      setElements((current) =>
        mergeIn(current, merged as El[], busy(), remote.current),
      );
      setSave(dirty.current ? "dirty" : "saved");
    } catch {
      dirty.current = true;
      setSave("error");
    } finally {
      inFlight.current = false;
    }
  }, [trpc, id, busy]);

  useEffect(() => {
    if (save !== "dirty" && save !== "error") return;

    // A failed save tries again by itself, a little later.
    const timer = setTimeout(() => void flush(), save === "dirty" ? 600 : 5000);

    return () => clearTimeout(timer);
  }, [save, elements, flush]);

  // Others' changes, and who else is here, while the board is in view.
  useEffect(() => {
    if (state !== "ready") return;

    const pull = setInterval(() => {
      if (document.visibilityState !== "visible" || inFlight.current) return;

      void (async () => {
        const { updatedAt } = await trpc.whiteboard.version.query({ id });

        // Nothing new since the last look: skip downloading the board.
        if (updatedAt === seen.current) return;

        const board = await trpc.whiteboard.get.query({ id });

        seen.current = board.updatedAt;
        setElements((current) =>
          mergeIn(current, board.elements as El[], busy(), remote.current),
        );
      })().catch(() => undefined);
    }, POLL_MS);
    const presence = () => {
      if (document.visibilityState !== "visible") return;

      void trpc.whiteboard.presence
        .mutate({ id, cursor: pointer.current })
        .then(setOthers)
        .catch(() => undefined);
    };

    presence();

    const ping = setInterval(presence, PRESENCE_MS);

    return () => {
      clearInterval(pull);
      clearInterval(ping);
    };
  }, [state, trpc, id, busy]);

  // Task cards show each task's status as it is now.
  const hasTasks = shown.some((el) => el.type === "task");

  useEffect(() => {
    if (!hasTasks) return;

    const load = () =>
      document.visibilityState === "visible" &&
      void trpc.task.getTasksByOrgId
        .query({})
        .then((tasks) =>
          setStatuses(new Map(tasks.map((task) => [task.key, task.status]))),
        )
        .catch(() => undefined);

    load();

    const timer = setInterval(load, 30_000);

    return () => clearInterval(timer);
  }, [hasTasks, trpc]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty.current) event.preventDefault();
    };

    window.addEventListener("beforeunload", warn);

    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  /** Applies a change; `record` keeps the board before it for undo. */
  const commit = useCallback((next: El[], record = true) => {
    if (record) {
      history.current.past = [
        ...history.current.past.slice(-99),
        latest.current,
      ];
      history.current.future = [];
    }

    latest.current = next;
    setElements(next);
    dirty.current = true;
    setSave("dirty");
  }, []);

  /** Replaces some shapes by id (each already touched). */
  const replace = useCallback(
    (changed: El[], record = true) => {
      const map = new Map(changed.map((el) => [el.id, el]));

      commit(
        latest.current.map((el) => map.get(el.id) ?? el),
        record,
      );
    },
    [commit],
  );

  const add = useCallback(
    (fresh: El[]) => {
      let z = topZ(latest.current);
      const placed = fresh.map((el) => ({ ...el, z: z++, v: el.v ?? 1 }));
      const map = new Map(placed.map((el) => [el.id, el]));
      const withLinks = placed.map((el) =>
        el.type === "arrow" || el.type === "line"
          ? route(
              el,
              new Map([
                ...latest.current.map((one) => [one.id, one] as const),
                ...map,
              ]),
            )
          : el,
      );

      commit([...latest.current, ...withLinks]);
      setSelected(withLinks.map((el) => el.id));
    },
    [commit],
  );

  const undo = useCallback(() => {
    const previous = history.current.past.pop();

    if (!previous) return;
    history.current.future.push(latest.current);
    commit(restore(previous, latest.current, remote.current), false);
    setSelected([]);
  }, [commit]);

  const redo = useCallback(() => {
    const next = history.current.future.pop();

    if (!next) return;
    history.current.past.push(latest.current);
    commit(restore(next, latest.current, remote.current), false);
  }, [commit]);

  // ---- selection helpers ----

  /** A shape plus the rest of its group. */
  const withGroup = useCallback(
    (el: El) =>
      el.groupId
        ? live(latest.current)
            .filter((one) => one.groupId === el.groupId)
            .map((one) => one.id)
        : [el.id],
    [],
  );

  const removeSelected = useCallback(() => {
    if (!selected.length) return;

    const gone = new Set(selected);

    replace(
      latest.current
        .filter((el) => gone.has(el.id) && !el.locked)
        .map((el) => touch(el, { deleted: true })),
    );
    setSelected([]);
  }, [selected, replace]);

  const restyle = useCallback(
    (change: Partial<El>) => {
      setStyle((current) => ({ ...current, ...change }) as typeof current);

      if (!selection.length) return;

      replace(selection.map((el) => touch(el, change)));
    },
    [selection, replace],
  );

  const copy = useCallback(() => {
    if (!selection.length) return;
    clipboard.current = selection;
  }, [selection]);

  const paste = useCallback(
    (offset = 24) => {
      if (!clipboard.current.length) return;

      const ids = new Map(clipboard.current.map((el) => [el.id, newId()]));
      const groups = new Map<string, string>();

      add(
        clipboard.current.map((el) => ({
          ...el,
          id: ids.get(el.id)!,
          x: el.x + offset,
          y: el.y + offset,
          v: 1,
          locked: false,
          groupId: el.groupId
            ? (groups.get(el.groupId) ??
              (groups.set(el.groupId, newId()), groups.get(el.groupId)!))
            : undefined,
          // A copied connector keeps only links inside the copy.
          start:
            el.start && ids.has(el.start.id)
              ? { id: ids.get(el.start.id)! }
              : undefined,
          end:
            el.end && ids.has(el.end.id)
              ? { id: ids.get(el.end.id)! }
              : undefined,
        })),
      );
    },
    [add],
  );

  const restack = useCallback(
    (front: boolean) => {
      if (!selection.length) return;

      const all = live(latest.current);
      let z = front
        ? topZ(all)
        : Math.min(...all.map((el) => el.z ?? 0)) - selection.length;

      replace(selection.map((el) => touch(el, { z: z++ })));
    },
    [selection, replace],
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
    [selection, selectionBox, replace, commit, selected],
  );

  const group = useCallback(
    (on: boolean) => {
      if (!selection.length) return;

      const groupId = on ? newId() : undefined;

      replace(selection.map((el) => touch(el, { groupId })));
    },
    [selection, replace],
  );

  const lock = useCallback(
    (on: boolean) => replace(selection.map((el) => touch(el, { locked: on }))),
    [selection, replace],
  );

  // ---- coordinates and zoom ----

  const toBoard = useCallback(
    (event: { clientX: number; clientY: number }): Point => {
      const rect = svgRef.current!.getBoundingClientRect();

      return {
        x: (event.clientX - rect.left - view.x) / view.k,
        y: (event.clientY - rect.top - view.y) / view.k,
      };
    },
    [view],
  );

  const viewCentre = useCallback((): Point => {
    const rect = svgRef.current?.getBoundingClientRect();

    return rect
      ? {
          x: (rect.width / 2 - view.x) / view.k,
          y: (rect.height / 2 - view.y) / view.k,
        }
      : { x: 0, y: 0 };
  }, [view]);

  const zoomBy = useCallback((factor: number, at?: Point) => {
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
  }, []);

  /** Fits a box (or the whole board) into view. */
  const fit = useCallback((box?: Box | null) => {
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
  }, []);

  const frames = useMemo(
    () =>
      shown
        .filter((el) => el.type === "frame")
        .sort((a, b) => a.y - b.y || a.x - b.x),
    [shown],
  );

  const present = useCallback(
    (index: number | null) => {
      setPresenting(index);
      setSelected([]);
      if (index !== null && frames[index]) fit(bounds(frames[index]));
    },
    [frames, fit],
  );

  // ---- adding things ----

  const addTask = useCallback(
    (task: PickedTask) => {
      const c = viewCentre();

      add([
        {
          id: newId(),
          type: "task",
          x: c.x - 130,
          y: c.y - 55,
          w: 260,
          h: 110,
          color: boardTheme.task.key,
          taskKey: task.key,
          taskTitle: task.name,
          taskStatus: task.status,
        },
      ]);
      setPicking(false);
      setTool("select");
    },
    [add, viewCentre],
  );

  const addImage = useCallback(
    async (file: File, at?: Point) => {
      const body = new FormData();

      body.append("file", file);
      body.append("library", "1");

      try {
        const response = await fetch(apiPath("/api/files"), {
          method: "POST",
          body,
        });
        const saved = (await response.json()) as {
          id?: string;
          width?: number | null;
          height?: number | null;
          error?: string;
        };

        if (!response.ok || !saved.id) {
          throw new Error(saved.error ?? "Could not upload the image.");
        }

        const scale = Math.min(
          1,
          480 / Math.max(saved.width ?? 480, saved.height ?? 360),
        );
        const w = (saved.width ?? 480) * scale;
        const h = (saved.height ?? 360) * scale;
        const c = at ?? viewCentre();

        add([
          {
            id: newId(),
            type: "image",
            x: c.x - w / 2,
            y: c.y - h / 2,
            w,
            h,
            color: boardTheme.text,
            fileId: saved.id,
          },
        ]);
      } catch (error) {
        toastError(
          "Could not add the image",
          error instanceof Error ? error.message : undefined,
        );
      }
    },
    [add, viewCentre],
  );

  const addTemplate = useCallback(
    (templateId: string) => {
      const template = templates.find((one) => one.id === templateId);

      if (!template) return;

      const c = viewCentre();
      const built = template.build({ x: c.x - 300, y: c.y - 200 });

      add(built);
      setMenu(null);
      fit(union(built.map(bounds)));
    },
    [add, viewCentre, fit],
  );

  const exportBoard = useCallback(
    async (format: "png" | "svg" | "copy") => {
      setMenu(null);

      const area = selectionBox ?? union(shown.map(bounds));

      if (!area || !layerRef.current) {
        toast("Nothing to export yet");
        return;
      }

      const dark = resolvedTheme === "dark";
      const name = (title || "board").replace(/[^\w-]+/g, "-");

      try {
        if (format === "svg") {
          const { markup } = await boardSvg(layerRef.current, area, dark);

          download(
            new Blob([markup], { type: "image/svg+xml" }),
            `${name}.svg`,
          );
        } else {
          const png = await boardPng(layerRef.current, area, dark);

          if (format === "png") download(png, `${name}.png`);
          else {
            await navigator.clipboard.write([
              new ClipboardItem({ "image/png": png }),
            ]);
            toast.success("Copied as an image");
          }
        }
      } catch (error) {
        toastError(
          "Could not export",
          error instanceof Error ? error.message : undefined,
        );
      }
    },
    [selectionBox, shown, resolvedTheme, title],
  );

  // ---- keyboard ----

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement;

      if (target.closest("textarea, input, [role=dialog]")) return;

      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();

      if (presenting !== null) {
        if (key === "arrowright" || key === " ")
          present(Math.min(frames.length - 1, presenting + 1));
        else if (key === "arrowleft") present(Math.max(0, presenting - 1));
        else if (key === "escape") present(null);
        event.preventDefault();
        return;
      }

      if (event.key === "?") {
        setHelpOpen((open) => !open);
        return;
      }

      if (key === "m" && !mod) {
        setShowMap((shown) => !shown);
        return;
      }

      if (key === " " && !space.current) {
        space.current = true;
        return;
      }

      if (mod && (key === "=" || key === "+")) {
        event.preventDefault();
        zoomBy(1.2);
        return;
      }

      if (mod && key === "-") {
        event.preventDefault();
        zoomBy(1 / 1.2);
        return;
      }

      if (event.shiftKey && key === "1") {
        fit();
        return;
      }

      if (!canEdit) return;

      if (mod && key === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if (mod && key === "y") {
        event.preventDefault();
        redo();
      } else if (mod && key === "a") {
        event.preventDefault();
        setSelected(shown.map((el) => el.id));
      } else if (mod && key === "c") {
        copy();
      } else if (mod && key === "x") {
        copy();
        removeSelected();
      } else if (mod && key === "v") {
        // Images are pasted by the paste event; shapes from our own copy.
        if (clipboard.current.length) {
          event.preventDefault();
          paste();
        }
      } else if (mod && key === "d") {
        event.preventDefault();
        copy();
        paste(20);
      } else if (mod && key === "g") {
        event.preventDefault();
        group(!event.shiftKey);
      } else if (mod && event.shiftKey && key === "l") {
        event.preventDefault();
        lock(!selection.every((el) => el.locked));
      } else if (key === "]") {
        restack(true);
      } else if (key === "[") {
        restack(false);
      } else if (key === "delete" || key === "backspace") {
        event.preventDefault();
        removeSelected();
      } else if (key === "escape") {
        setSelected([]);
        setTool("select");
      } else if (
        key === "enter" &&
        selection.length === 1 &&
        holdsLabel(selection[0]!)
      ) {
        event.preventDefault();
        setEditing({ id: selection[0]!.id, text: selection[0]!.text ?? "" });
      } else if (key.startsWith("arrow") && selection.length) {
        event.preventDefault();

        const step = event.shiftKey ? 10 : 1;
        const dx =
          key === "arrowleft" ? -step : key === "arrowright" ? step : 0;
        const dy = key === "arrowup" ? -step : key === "arrowdown" ? step : 0;

        replace(
          selection
            .filter((el) => !el.locked)
            .map((el) => touch(el, { x: el.x + dx, y: el.y + dy })),
        );
        commit(rerouteAround(latest.current, new Set(selected)), false);
      } else if (!mod && !event.altKey) {
        const pick = tools.find((one) => one.key === key);

        if (pick) setTool(pick.id);
      }
    }

    function onKeyUp(event: KeyboardEvent) {
      if (event.key === " ") space.current = false;
    }

    function onPaste(event: ClipboardEvent) {
      if (!canEdit || (event.target as HTMLElement).closest("textarea, input"))
        return;

      const image = Array.from(event.clipboardData?.files ?? []).find((file) =>
        file.type.startsWith("image/"),
      );

      if (image) {
        event.preventDefault();
        void addImage(image);
      }
    }

    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("paste", onPaste);

    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("paste", onPaste);
    };
  }, [
    canEdit,
    undo,
    redo,
    copy,
    paste,
    group,
    lock,
    restack,
    removeSelected,
    replace,
    commit,
    selection,
    selected,
    shown,
    presenting,
    present,
    frames,
    zoomBy,
    fit,
    addImage,
  ]);

  // ---- pointer ----

  function onWheel(event: React.WheelEvent) {
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

  function startMove(from: Point, ids: string[]) {
    const all = live(latest.current);
    const moving = new Map<string, El>();

    for (const el of all) {
      if (ids.includes(el.id) && !el.locked) moving.set(el.id, el);
    }

    // A frame carries what sits inside it.
    for (const frame of [...moving.values()].filter(
      (el) => el.type === "frame",
    )) {
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

  function onDown(event: ReactPointerEvent<SVGSVGElement>) {
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
        startMove(p, next);
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

  function onMove(event: ReactPointerEvent<SVGSVGElement>) {
    const p = toBoard(event);

    pointer.current = p;

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

  function onUp(event: ReactPointerEvent<SVGSVGElement>) {
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
      // Nothing moved: drop the undo step the press recorded.
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
      const over = topAt(
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

      // A click without a drag makes no line.
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

    // A click instead of a drag makes a shape of a useful size.
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
      // Double-clicking empty space writes there.
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

    // An empty text box is removed rather than left as an invisible shape.
    // An empty text box or comment is removed, not left as an empty shape.
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

  // ---- rendering ----

  if (state === "loading")
    return (
      <p role="status" className="p-6 text-sm text-ink-2">
        Loading board…
      </p>
    );

  if (state === "missing")
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-ink">This board could not be opened.</p>
        <Button asChild variant="outline">
          <Link href="/whiteboards">Back to boards</Link>
        </Button>
      </div>
    );

  const single = selection.length === 1 ? selection[0]! : null;
  const linearSingle =
    single && isLinear(single) && single.type !== "pen" ? single : null;
  const editingEl = editing ? byId.get(editing.id) : undefined;
  const editingBox = editingEl
    ? editingEl.type === "comment"
      ? // A comment is typed beside its pin.
        { x: editingEl.x + 36, y: editingEl.y, w: 260, h: 110 }
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

  return (
    <div className="relative -mx-4 -mt-5 -mb-12 flex h-[calc(100svh-3.5rem)] min-h-[480px] flex-col overflow-hidden border-t border-hairline md:-mx-(--gutter) md:-mt-7 md:-mb-16">
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
            <Button variant="outline" size="sm" onClick={() => present(0)}>
              <PresentationIcon aria-hidden />
              Present
            </Button>
          ) : null}
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden bg-sunken/40">
        {canEdit && presenting === null ? (
          <div
            role="toolbar"
            aria-label="Drawing tools"
            className="absolute top-3 left-1/2 z-10 flex max-w-[calc(100%-1rem)] -translate-x-1/2 items-center gap-1 overflow-x-auto rounded-xl border border-line bg-canvas p-1 shadow-sm [&>*]:shrink-0"
          >
            {tools.map(({ id: toolId, label, key, icon: Icon }) => (
              <Button
                key={toolId}
                size="icon-sm"
                variant={tool === toolId ? "secondary" : "ghost"}
                aria-label={label}
                aria-pressed={tool === toolId}
                title={`${label} — ${key.toUpperCase()}`}
                onClick={() => setTool(toolId)}
              >
                <Icon aria-hidden />
              </Button>
            ))}
            <span className="mx-1 h-5 w-px bg-line" aria-hidden />
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Add image"
              title="Add image"
              onClick={() => fileRef.current?.click()}
            >
              <ImageIcon aria-hidden />
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Add task card"
              title="Add task card"
              onClick={() => setPicking(true)}
            >
              <CheckSquareIcon aria-hidden />
            </Button>
            <Button
              size="icon-sm"
              variant={menu === "templates" ? "secondary" : "ghost"}
              aria-label="Templates"
              aria-expanded={menu === "templates"}
              title="Templates"
              onClick={() => setMenu(menu === "templates" ? null : "templates")}
            >
              <LayoutTemplateIcon aria-hidden />
            </Button>
            <Button
              size="icon-sm"
              variant={menu === "export" ? "secondary" : "ghost"}
              aria-label="Export"
              aria-expanded={menu === "export"}
              title="Export"
              onClick={() => setMenu(menu === "export" ? null : "export")}
            >
              <DownloadIcon aria-hidden />
            </Button>
            <Button
              size="icon-sm"
              variant={grid ? "secondary" : "ghost"}
              aria-label="Snap to grid"
              aria-pressed={grid}
              title="Snap to grid"
              onClick={() => setGrid(!grid)}
            >
              <Grid3x3Icon aria-hidden />
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              hidden
              aria-label="Image to add"
              onChange={(event) => {
                const file = event.target.files?.[0];

                if (file) void addImage(file);
                event.target.value = "";
              }}
            />
          </div>
        ) : null}

        {menu === "templates" ? (
          <ul
            aria-label="Templates"
            className="absolute top-14 left-1/2 z-20 w-72 -translate-x-1/2 overflow-hidden rounded-xl border border-line bg-canvas shadow-lg"
          >
            {templates.map((template) => (
              <li key={template.id}>
                <button
                  type="button"
                  className="flex w-full flex-col px-4 py-2 text-left hover:bg-hover"
                  onClick={() => addTemplate(template.id)}
                >
                  <span className="text-sm font-medium text-ink">
                    {template.name}
                  </span>
                  <span className="text-xs text-ink-2">
                    {template.description}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {menu === "export" ? (
          <ul
            aria-label="Export"
            className="absolute top-14 left-1/2 z-20 w-60 -translate-x-1/2 overflow-hidden rounded-xl border border-line bg-canvas shadow-lg"
          >
            {(
              [
                ["png", "Download PNG"],
                ["svg", "Download SVG"],
                ["copy", "Copy as image"],
              ] as const
            ).map(([format, label]) => (
              <li key={format}>
                <button
                  type="button"
                  className="w-full px-4 py-2 text-left text-sm hover:bg-hover"
                  onClick={() => void exportBoard(format)}
                >
                  {label}
                  {selection.length ? " (selection)" : ""}
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {showStyle && presenting === null ? (
          <aside
            aria-label="Style"
            className="absolute top-16 left-3 z-10 flex max-h-[calc(100%-6rem)] w-56 flex-col gap-3 overflow-y-auto rounded-xl border border-line bg-canvas p-3 text-xs shadow-sm"
          >
            <fieldset className="flex flex-col gap-1.5">
              <legend className="mb-1 text-ink-2">Stroke</legend>
              <div className="flex flex-wrap gap-1.5">
                {palette.map((colour) => (
                  <button
                    key={colour}
                    type="button"
                    aria-label={`Stroke ${colour}`}
                    aria-pressed={(single?.color ?? style.color) === colour}
                    onClick={() => restyle({ color: colour })}
                    className={`size-6 rounded-full border-2 ${(single?.color ?? style.color) === colour ? "border-ink" : "border-line"}`}
                    style={{
                      background: colour === "ink" ? "currentColor" : colour,
                    }}
                  />
                ))}
              </div>
            </fieldset>
            <fieldset className="flex flex-col gap-1.5">
              <legend className="mb-1 text-ink-2">Fill</legend>
              <div className="flex flex-wrap gap-1.5">
                {fills.map((colour) => (
                  <button
                    key={colour}
                    type="button"
                    aria-label={
                      colour === "none" ? "No fill" : `Fill ${colour}`
                    }
                    aria-pressed={(single?.fill ?? style.fill) === colour}
                    onClick={() => restyle({ fill: colour })}
                    className={`size-6 rounded-md border-2 ${(single?.fill ?? style.fill) === colour ? "border-ink" : "border-line"}`}
                    style={{
                      background:
                        colour === "none"
                          ? `repeating-conic-gradient(${boardTheme.checker} 0 25%, transparent 0 50%) 0 0 / 8px 8px`
                          : colour,
                    }}
                  />
                ))}
              </div>
            </fieldset>
            <fieldset className="flex items-center gap-1.5">
              <legend className="mb-1 text-ink-2">Stroke width</legend>
              {[1, 2, 4, 8].map((width) => (
                <Button
                  key={width}
                  size="sm"
                  variant={
                    (single?.strokeWidth ?? style.strokeWidth) === width
                      ? "secondary"
                      : "ghost"
                  }
                  aria-label={`Width ${width}`}
                  onClick={() => restyle({ strokeWidth: width })}
                >
                  <span
                    className="block w-5 rounded-full bg-ink"
                    style={{ height: Math.max(1, width / 1.5) }}
                  />
                </Button>
              ))}
            </fieldset>
            <fieldset className="flex items-center gap-1.5">
              <legend className="mb-1 text-ink-2">Line</legend>
              {(["solid", "dashed", "dotted"] as const).map((dash) => (
                <Button
                  key={dash}
                  size="sm"
                  variant={
                    (single?.dash ?? style.dash) === dash
                      ? "secondary"
                      : "ghost"
                  }
                  onClick={() => restyle({ dash })}
                >
                  {dash}
                </Button>
              ))}
            </fieldset>
            <fieldset className="flex flex-wrap items-center gap-1.5">
              <legend className="mb-1 text-ink-2">Text size</legend>
              {[14, 18, 28, 44].map((size, i) => (
                <Button
                  key={size}
                  size="sm"
                  variant={
                    (single?.fontSize ?? style.fontSize) === size
                      ? "secondary"
                      : "ghost"
                  }
                  aria-label={`Text size ${["small", "medium", "large", "huge"][i]}`}
                  onClick={() => restyle({ fontSize: size })}
                >
                  {["S", "M", "L", "XL"][i]}
                </Button>
              ))}
            </fieldset>
            <label className="flex items-center gap-2 text-ink">
              <input
                type="checkbox"
                checked={single?.sketch ?? style.sketch}
                onChange={(event) => restyle({ sketch: event.target.checked })}
              />
              Hand-drawn look
            </label>
            {single && (single.type === "rect" || single.type === "frame") ? (
              <label className="flex items-center gap-2 text-ink">
                <input
                  type="checkbox"
                  checked={Boolean(single.rounded)}
                  onChange={(event) =>
                    restyle({ rounded: event.target.checked })
                  }
                />
                Rounded corners
              </label>
            ) : null}
            {linearSingle ? (
              <label className="flex items-center gap-2 text-ink">
                <input
                  type="checkbox"
                  checked={Boolean(linearSingle.elbow)}
                  onChange={(event) => {
                    const next = touch(linearSingle, {
                      elbow: event.target.checked,
                    });

                    replace([
                      route(
                        next,
                        new Map(latest.current.map((one) => [one.id, one])),
                      ),
                    ]);
                  }}
                />
                Elbow connector
              </label>
            ) : null}
            {single?.type === "sticky" ? (
              <fieldset className="flex flex-wrap gap-1.5">
                <legend className="mb-1 text-ink-2">Note colour</legend>
                {stickyColors.map((colour) => (
                  <button
                    key={colour}
                    type="button"
                    aria-label={`Note ${colour}`}
                    onClick={() => restyle({ fill: colour })}
                    className="size-6 rounded-md border-2 border-line"
                    style={{ background: colour }}
                  />
                ))}
              </fieldset>
            ) : null}
            <label className="flex flex-col gap-1 text-ink-2">
              Opacity
              <input
                type="range"
                min={10}
                max={100}
                step={10}
                value={Math.round((single?.opacity ?? 1) * 100)}
                onChange={(event) =>
                  restyle({ opacity: Number(event.target.value) / 100 })
                }
                aria-label="Opacity"
              />
            </label>
            {selection.length ? (
              <>
                <div className="flex flex-wrap gap-1" aria-label="Arrange">
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Bring to front"
                    title="Bring to front — ]"
                    onClick={() => restack(true)}
                  >
                    <BringToFrontIcon aria-hidden />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Send to back"
                    title="Send to back — ["
                    onClick={() => restack(false)}
                  >
                    <SendToBackIcon aria-hidden />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Duplicate"
                    title="Duplicate — Ctrl D"
                    onClick={() => {
                      copy();
                      paste(20);
                    }}
                  >
                    <CopyIcon aria-hidden />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={allLocked ? "Unlock" : "Lock"}
                    onClick={() => lock(!allLocked)}
                  >
                    {allLocked ? (
                      <UnlockIcon aria-hidden />
                    ) : (
                      <LockIcon aria-hidden />
                    )}
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Delete selected"
                    onClick={removeSelected}
                  >
                    <Trash2Icon aria-hidden />
                  </Button>
                </div>
                {selection.length > 1 ? (
                  <div className="flex flex-wrap gap-1" aria-label="Align">
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Align left"
                      onClick={() => align("left")}
                    >
                      <AlignStartVerticalIcon aria-hidden />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Align centres"
                      onClick={() => align("hcentre")}
                    >
                      <AlignCenterVerticalIcon aria-hidden />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Align right"
                      onClick={() => align("right")}
                    >
                      <AlignEndVerticalIcon aria-hidden />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Align top"
                      onClick={() => align("top")}
                    >
                      <AlignStartHorizontalIcon aria-hidden />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Align middles"
                      onClick={() => align("vcentre")}
                    >
                      <AlignCenterHorizontalIcon aria-hidden />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Align bottom"
                      onClick={() => align("bottom")}
                    >
                      <AlignEndHorizontalIcon aria-hidden />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Group"
                      title="Group — Ctrl G"
                      onClick={() => group(true)}
                    >
                      <GroupIcon aria-hidden />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Ungroup"
                      title="Ungroup — Ctrl Shift G"
                      onClick={() => group(false)}
                    >
                      <UngroupIcon aria-hidden />
                    </Button>
                  </div>
                ) : null}
              </>
            ) : null}
          </aside>
        ) : null}

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
            pointer.current = null;
          }}
          onWheel={onWheel}
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
            ) : null}

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
          </g>
        </svg>

        {editing && editingEl && editingBox ? (
          <textarea
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
      </div>

      <TaskPicker open={picking} onOpenChange={setPicking} onPick={addTask} />
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Keyboard shortcuts</DialogTitle>
          </DialogHeader>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            {shortcuts.map(([keys, what]) => (
              <div key={keys} className="contents">
                <dt className="font-mono text-xs text-ink">{keys}</dt>
                <dd className="text-ink-2">{what}</dd>
              </div>
            ))}
          </dl>
        </DialogContent>
      </Dialog>
    </div>
  );
}
