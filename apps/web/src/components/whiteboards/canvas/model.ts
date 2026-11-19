import { boardColors, boardTheme } from "@zentro/ui/lib/theme-colors";

export type Kind =
  | "pen"
  | "rect"
  | "ellipse"
  | "diamond"
  | "line"
  | "arrow"
  | "text"
  | "sticky"
  | "task"
  | "frame"
  | "image"
  | "comment";

export type Dash = "solid" | "dashed" | "dotted";
export type Align = "left" | "center" | "right";

/** One shape on the board, as stored (see `boardElement` on the server). */
export type El = {
  id: string;
  type: Kind;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Flat [x, y, x, y, …] pairs relative to x, y. */
  points?: number[];
  color: string;
  fill?: string;
  strokeWidth?: number;
  dash?: Dash;
  opacity?: number;
  rounded?: boolean;
  sketch?: boolean;
  fontSize?: number;
  align?: Align;
  text?: string;
  groupId?: string;
  locked?: boolean;
  start?: { id: string };
  end?: { id: string };
  elbow?: boolean;
  fileId?: string;
  author?: string;
  taskKey?: string;
  taskTitle?: string;
  taskStatus?: string;
  taskPriority?: string;
  /** Stacking order: higher is drawn on top. */
  z?: number;
  /** The shape's own version; saves merge shape by shape on it. */
  v?: number;
  deleted?: boolean;
};

export type Box = { x: number; y: number; w: number; h: number };
export type Point = { x: number; y: number };

export const palette = boardColors;

/** Sticky note colours, light enough for dark text in either theme. */
export const stickyColors = boardTheme.stickies;

export const fills = ["none", ...stickyColors, boardTheme.neutralFill] as const;

export const newId = () =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export const clamp = (n: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, n));

export const isLinear = (el: El) =>
  el.type === "pen" || el.type === "line" || el.type === "arrow";

/** Shapes that hold a text label inside them. */
export const holdsLabel = (el: El) =>
  el.type === "rect" ||
  el.type === "ellipse" ||
  el.type === "diamond" ||
  el.type === "sticky" ||
  el.type === "text" ||
  el.type === "frame" ||
  el.type === "comment";

/** A changed copy of a shape, one version newer, so the change wins merges. */
export function touch(el: El, change: Partial<El> = {}): El {
  return { ...el, ...change, v: (el.v ?? 0) + 1 };
}

/** The live (not deleted) shapes, bottom to top. */
export const live = (elements: El[]) =>
  elements.filter((el) => !el.deleted).sort((a, b) => (a.z ?? 0) - (b.z ?? 0));

/** A stacking value above everything on the board. */
export const topZ = (elements: El[]) =>
  elements.reduce((max, el) => Math.max(max, el.z ?? 0), 0) + 1;

export function pairs(flat: number[] = []): Point[] {
  const points: Point[] = [];

  for (let i = 0; i + 1 < flat.length; i += 2) {
    points.push({ x: flat[i]!, y: flat[i + 1]! });
  }

  return points;
}

export function bounds(el: El): Box {
  if (isLinear(el)) {
    const p = pairs(el.points);

    if (!p.length) return { x: el.x, y: el.y, w: 0, h: 0 };

    const xs = p.map((q) => q.x);
    const ys = p.map((q) => q.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);

    return {
      x: el.x + minX,
      y: el.y + minY,
      w: Math.max(...xs) - minX,
      h: Math.max(...ys) - minY,
    };
  }

  return { x: el.x, y: el.y, w: el.w, h: el.h };
}

export function union(boxes: Box[]): Box | null {
  if (!boxes.length) return null;

  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  const right = Math.max(...boxes.map((b) => b.x + b.w));
  const bottom = Math.max(...boxes.map((b) => b.y + b.h));

  return { x, y, w: right - x, h: bottom - y };
}

export const contains = (outer: Box, inner: Box) =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.w <= outer.x + outer.w &&
  inner.y + inner.h <= outer.y + outer.h;

export const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export const centre = (box: Box): Point => ({
  x: box.x + box.w / 2,
  y: box.y + box.h / 2,
});

/** Rounds to the grid when snapping is on. */
export const snap = (n: number, on: boolean, grid = 20) =>
  on ? Math.round(n / grid) * grid : n;

/** A default look for each new shape. */
export function defaults(type: Kind, color: string): Partial<El> {
  if (type === "sticky") {
    return { fill: stickyColors[0], color: boardTheme.text, fontSize: 18 };
  }

  if (type === "frame") {
    return {
      fill: "none",
      color: boardTheme.frame,
      strokeWidth: 1,
      fontSize: 16,
    };
  }

  if (type === "text") return { fontSize: 20, color };

  return { color, strokeWidth: 2, fontSize: 18 };
}
