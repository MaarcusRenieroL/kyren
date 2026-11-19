import {
  bounds,
  centre,
  isLinear,
  pairs,
  touch,
  type Box,
  type El,
  type Point,
} from "./model";

function distanceToSegment(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = dx * dx + dy * dy;
  const t = length
    ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length))
    : 0;

  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/**
 * Whether a point (board coordinates) is on a shape. Frames are only grabbed
 * by their edge and title, so what sits inside them stays easy to pick.
 */
export function hits(el: El, p: Point, tolerance: number) {
  if (isLinear(el)) {
    const points = pairs(el.points).map((q) => ({
      x: el.x + q.x,
      y: el.y + q.y,
    }));

    for (let i = 1; i < points.length; i += 1) {
      if (distanceToSegment(p, points[i - 1]!, points[i]!) <= tolerance) {
        return true;
      }
    }

    return (
      points.length === 1 &&
      Math.hypot(p.x - points[0]!.x, p.y - points[0]!.y) <= tolerance
    );
  }

  const box = bounds(el);
  const inside =
    p.x >= box.x - tolerance &&
    p.x <= box.x + box.w + tolerance &&
    p.y >= box.y - tolerance &&
    p.y <= box.y + box.h + tolerance;

  if (!inside) return false;

  if (el.type === "frame") {
    const nearEdge =
      p.x <= box.x + tolerance ||
      p.x >= box.x + box.w - tolerance ||
      p.y <= box.y + tolerance ||
      p.y >= box.y + box.h - tolerance;

    return nearEdge || p.y <= box.y + 28;
  }

  if (el.type === "ellipse") {
    const rx = box.w / 2 + tolerance;
    const ry = box.h / 2 + tolerance;
    const c = centre(box);

    return ((p.x - c.x) / rx) ** 2 + ((p.y - c.y) / ry) ** 2 <= 1;
  }

  return true;
}

/** The topmost shape under a point, skipping deleted ones. */
export function topAt(elements: El[], p: Point, tolerance: number) {
  for (let i = elements.length - 1; i >= 0; i -= 1) {
    const el = elements[i]!;

    if (!el.deleted && hits(el, p, tolerance)) return el;
  }

  return null;
}

/**
 * Where a line from a shape's centre towards `toward` leaves the shape: the
 * point a connector attaches at, on the edge of a box, ellipse or diamond.
 */
export function edgePoint(el: El, toward: Point): Point {
  const box = bounds(el);
  const c = centre(box);
  const dx = toward.x - c.x;
  const dy = toward.y - c.y;

  if (!dx && !dy) return c;

  const hw = box.w / 2 || 1;
  const hh = box.h / 2 || 1;
  let scale: number;

  if (el.type === "ellipse") {
    scale = 1 / Math.sqrt((dx / hw) ** 2 + (dy / hh) ** 2);
  } else if (el.type === "diamond") {
    scale = 1 / (Math.abs(dx) / hw + Math.abs(dy) / hh);
  } else {
    scale = Math.min(hw / Math.abs(dx || 1e-9), hh / Math.abs(dy || 1e-9));
  }

  return { x: c.x + dx * scale, y: c.y + dy * scale };
}

/**
 * Lays a connector between the shapes it is attached to (either end may be
 * free), straight or with one elbow. Returns the arrow with new points.
 */
export function route(arrow: El, byId: Map<string, El>): El {
  const points = pairs(arrow.points).map((q) => ({
    x: arrow.x + q.x,
    y: arrow.y + q.y,
  }));
  const from = arrow.start ? byId.get(arrow.start.id) : undefined;
  const to = arrow.end ? byId.get(arrow.end.id) : undefined;

  if ((!from || from.deleted) && (!to || to.deleted)) return arrow;

  let a = points[0] ?? { x: arrow.x, y: arrow.y };
  let b = points[points.length - 1] ?? a;
  const fromCentre = from && !from.deleted ? centre(bounds(from)) : a;
  const toCentre = to && !to.deleted ? centre(bounds(to)) : b;

  if (from && !from.deleted) a = edgePoint(from, toCentre);
  if (to && !to.deleted) b = edgePoint(to, fromCentre);

  const path: Point[] = arrow.elbow
    ? [a, { x: (a.x + b.x) / 2, y: a.y }, { x: (a.x + b.x) / 2, y: b.y }, b]
    : [a, b];
  const flat = path.flatMap((q) => [q.x - a.x, q.y - a.y]);
  const same =
    arrow.x === a.x &&
    arrow.y === a.y &&
    flat.length === arrow.points?.length &&
    flat.every((value, i) => Math.abs(value - arrow.points![i]!) < 0.01);

  return same ? arrow : touch(arrow, { x: a.x, y: a.y, points: flat });
}

/** Re-lays every connector attached to one of `moved`. */
export function rerouteAround(elements: El[], moved: Set<string>): El[] {
  const byId = new Map(elements.map((el) => [el.id, el]));

  return elements.map((el) =>
    el.type === "arrow" || el.type === "line"
      ? (el.start && moved.has(el.start.id)) || (el.end && moved.has(el.end.id))
        ? route(el, byId)
        : el
      : el,
  );
}

/** Scales a shape from one box to another (resizing a selection). */
export function scaleInto(el: El, from: Box, to: Box): El {
  const sx = from.w ? to.w / from.w : 1;
  const sy = from.h ? to.h / from.h : 1;
  const x = to.x + (el.x - from.x) * sx;
  const y = to.y + (el.y - from.y) * sy;

  if (el.points) {
    return touch(el, {
      x,
      y,
      points: el.points.map((value, i) => value * (i % 2 === 0 ? sx : sy)),
    });
  }

  return touch(el, {
    x,
    y,
    w: Math.max(4, el.w * sx),
    h: Math.max(4, el.h * sy),
  });
}

/** A tiny deterministic random source, so a sketchy shape looks the same every time. */
function seeded(seed: string) {
  let h = 2166136261;

  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }

  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;

    return (h >>> 0) / 4294967296;
  };
}

/**
 * A hand-drawn version of a path through `points`: each stroke is drawn
 * twice with small wobbles, the way a pen line is never quite straight.
 */
export function sketchPath(points: Point[], closed: boolean, seed: string) {
  const random = seeded(seed);
  const wobble = () => (random() - 0.5) * 3;
  const all = closed ? [...points, points[0]!] : points;
  let d = "";

  for (let pass = 0; pass < 2; pass += 1) {
    for (let i = 1; i < all.length; i += 1) {
      const a = all[i - 1]!;
      const b = all[i]!;
      const mx = (a.x + b.x) / 2 + wobble();
      const my = (a.y + b.y) / 2 + wobble();

      d += `M${a.x + wobble()} ${a.y + wobble()} Q${mx} ${my} ${b.x + wobble()} ${b.y + wobble()} `;
    }
  }

  return d;
}

/** Points around an ellipse inside a box, for drawing it sketchily. */
export function ellipsePoints(box: Box, count = 24): Point[] {
  const c = centre(box);

  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2;

    return {
      x: c.x + (box.w / 2) * Math.cos(angle),
      y: c.y + (box.h / 2) * Math.sin(angle),
    };
  });
}
