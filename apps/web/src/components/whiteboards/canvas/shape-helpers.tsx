import { ellipsePoints } from "./geometry";
import { bounds, type El, type Point } from "./model";

export const FONT = "system-ui, -apple-system, Segoe UI, sans-serif";
let measurer: CanvasRenderingContext2D | null = null;

/** Splits text into lines that fit `width`, the way a text box wraps. */
export function wrap(text: string, width: number, fontSize: number) {
  if (!measurer) {
    measurer = document.createElement("canvas").getContext("2d");
  }

  const ctx = measurer;

  if (ctx) ctx.font = `${fontSize}px ${FONT}`;

  const measure = (value: string) =>
    ctx ? ctx.measureText(value).width : value.length * fontSize * 0.55;
  const lines: string[] = [];

  for (const paragraph of text.split("\n")) {
    let line = "";

    for (const word of paragraph.split(/(\s+)/)) {
      const next = line + word;

      if (line && measure(next.trimEnd()) > width) {
        lines.push(line.trimEnd());
        line = word.trimStart();
      } else {
        line = next;
      }
    }

    lines.push(line);
  }

  return lines;
}

export const dashArray = (el: El) => {
  const w = el.strokeWidth ?? 2;

  return el.dash === "dashed"
    ? `${w * 4} ${w * 3}`
    : el.dash === "dotted"
      ? `${w} ${w * 2.2}`
      : undefined;
};

/** The board's own colour for "ink", which follows the theme. */
export const paint = (value: string | undefined, fallback: string) =>
  !value || value === "none"
    ? fallback
    : value === "ink"
      ? "currentColor"
      : value;

export function Label({
  el,
  inset = 10,
  live,
}: {
  el: El;
  inset?: number;
  live?: string;
}) {
  const text = live ?? el.text;

  if (!text) return null;

  const box = bounds(el);
  const size = el.fontSize ?? 18;
  const width = Math.max(10, box.w - inset * 2);
  const lines = wrap(text, width, size);
  const lineHeight = size * 1.25;
  const align = el.align ?? (el.type === "text" ? "left" : "center");
  const anchor =
    align === "left" ? "start" : align === "right" ? "end" : "middle";
  const x =
    align === "left"
      ? box.x + inset
      : align === "right"
        ? box.x + box.w - inset
        : box.x + box.w / 2;
  const top =
    el.type === "text" || el.type === "sticky" || el.type === "frame"
      ? box.y + inset + size * 0.9
      : box.y + box.h / 2 - (lines.length * lineHeight) / 2 + size * 0.9;

  return (
    <text
      x={x}
      y={top}
      textAnchor={anchor}
      fontFamily={FONT}
      fontSize={size}
      fill={paint(el.color, "currentColor")}
      style={{ userSelect: "none" }}
    >
      {lines.map((line, i) => (
        <tspan key={i} x={x} dy={i === 0 ? 0 : lineHeight}>
          {line || " "}
        </tspan>
      ))}
    </text>
  );
}

export function outline(el: El): { points: Point[]; closed: boolean } | null {
  const box = bounds(el);

  if (el.type === "rect" || el.type === "frame") {
    return {
      closed: true,
      points: [
        { x: box.x, y: box.y },
        { x: box.x + box.w, y: box.y },
        { x: box.x + box.w, y: box.y + box.h },
        { x: box.x, y: box.y + box.h },
      ],
    };
  }

  if (el.type === "diamond") {
    return {
      closed: true,
      points: [
        { x: box.x + box.w / 2, y: box.y },
        { x: box.x + box.w, y: box.y + box.h / 2 },
        { x: box.x + box.w / 2, y: box.y + box.h },
        { x: box.x, y: box.y + box.h / 2 },
      ],
    };
  }

  if (el.type === "ellipse")
    return { closed: true, points: ellipsePoints(box) };

  return null;
}

export const smoothPen = (points: Point[]) =>
  points.reduce((d, q, i) => d + `${i === 0 ? "M" : "L"}${q.x} ${q.y} `, "");
