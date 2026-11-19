"use client";

import { useRef } from "react";

import { bounds, union, type Box, type El, type Point } from "./model";

const WIDTH = 200;
const HEIGHT = 130;
const PAD = 8;

/**
 * The whole board in miniature, with the part on screen outlined. Clicking
 * or dragging on it brings that spot to the middle of the screen.
 */
export function Minimap({
  shapes,
  visible,
  onCenter,
}: {
  shapes: El[];
  /** The part of the board on screen, in board coordinates. */
  visible: Box;
  onCenter: (point: Point) => void;
}) {
  const dragging = useRef(false);
  const world = union([...shapes.map(bounds), visible])!;
  const scale = Math.min(
    (WIDTH - PAD * 2) / (world.w || 1),
    (HEIGHT - PAD * 2) / (world.h || 1),
  );
  const offsetX = (WIDTH - world.w * scale) / 2 - world.x * scale;
  const offsetY = (HEIGHT - world.h * scale) / 2 - world.y * scale;
  const place = (box: Box) => ({
    x: box.x * scale + offsetX,
    y: box.y * scale + offsetY,
    width: Math.max(2, box.w * scale),
    height: Math.max(2, box.h * scale),
  });

  const centerAt = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();

    onCenter({
      x: (event.clientX - rect.left - offsetX) / scale,
      y: (event.clientY - rect.top - offsetY) / scale,
    });
  };

  return (
    <div
      role="img"
      aria-label="Map of the whole board"
      className="block cursor-pointer touch-none overflow-hidden rounded-lg border border-line bg-canvas shadow-sm"
      style={{ width: WIDTH, height: HEIGHT }}
      onPointerDown={(event) => {
        event.stopPropagation();
        dragging.current = true;
        centerAt(event);
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (dragging.current) centerAt(event);
      }}
      onPointerUp={() => {
        dragging.current = false;
      }}
      onPointerCancel={() => {
        dragging.current = false;
      }}
    >
      <svg width={WIDTH} height={HEIGHT} className="block" aria-hidden>
        {shapes.map((el) => (
          <rect
            key={el.id}
            {...place(bounds(el))}
            rx={1}
            className="fill-current text-ink-3"
            opacity={0.45}
          />
        ))}
        <rect
          {...place(visible)}
          className="fill-accent stroke-accent"
          fillOpacity={0.08}
          strokeWidth={1.5}
        />
      </svg>
    </div>
  );
}
