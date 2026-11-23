import { palette, type Box, type Point } from "../canvas/model";
import type { Handle } from "./editor-types";

/** A steady colour per person, from the board palette. */
export function personColour(id: string) {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return palette[1 + (Math.abs(hash) % (palette.length - 1))]!;
}

export function handlePoint(box: Box, handle: Handle): Point {
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
export function resized(
  box: Box,
  handle: Handle,
  p: Point,
  keepRatio: boolean,
): Box {
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
