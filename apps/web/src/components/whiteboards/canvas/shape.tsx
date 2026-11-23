import type React from "react";
import { boardTheme } from "@zentro/ui/lib/theme-colors";
import { apiPath } from "~/src/lib/paths";
import { sketchPath } from "./geometry";
import { bounds, pairs, type El } from "./model";
import {
  FONT,
  Label,
  dashArray,
  outline,
  paint,
  smoothPen,
  wrap,
} from "./shape-helpers";

export { wrap };

/**
 * One shape, drawn in board coordinates. `live` is text being typed, shown
 * before it is saved; `status` is a task card's current status.
 */
export function Shape({
  el,
  live,
  status,
}: {
  el: El;
  live?: string;
  status?: string;
}) {
  const box = bounds(el);
  const stroke = paint(el.color, "currentColor");
  const fill = el.fill && el.fill !== "none" ? paint(el.fill, "none") : "none";
  const width = el.strokeWidth ?? 2;
  const common = {
    stroke,
    strokeWidth: width,
    strokeDasharray: dashArray(el),
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  const opacity = el.opacity ?? 1;

  if (el.type === "pen" || el.type === "line" || el.type === "arrow") {
    const points = pairs(el.points).map((q) => ({
      x: el.x + q.x,
      y: el.y + q.y,
    }));
    const d =
      el.sketch && el.type !== "pen"
        ? sketchPath(points, false, el.id)
        : smoothPen(points);
    let head = "";

    if (el.type === "arrow" && points.length >= 2) {
      const a = points[points.length - 2]!;
      const b = points[points.length - 1]!;
      const angle = Math.atan2(b.y - a.y, b.x - a.x);
      const size = 10 + width * 2;

      head = `M${b.x - size * Math.cos(angle - 0.45)} ${b.y - size * Math.sin(angle - 0.45)} L${b.x} ${b.y} L${b.x - size * Math.cos(angle + 0.45)} ${b.y - size * Math.sin(angle + 0.45)}`;
    }

    return (
      <g opacity={opacity}>
        <path d={d} fill="none" {...common} />
        {head ? (
          <path d={head} fill="none" {...common} strokeDasharray={undefined} />
        ) : null}
      </g>
    );
  }

  if (el.type === "image") {
    return (
      <image
        href={el.fileId ? apiPath(`/api/files/${el.fileId}`) : undefined}
        x={box.x}
        y={box.y}
        width={box.w}
        height={box.h}
        opacity={opacity}
        preserveAspectRatio="xMidYMid meet"
      />
    );
  }

  if (el.type === "task") {
    const current = status ?? el.taskStatus ?? "todo";

    return (
      <g opacity={opacity}>
        <rect
          x={box.x}
          y={box.y}
          width={box.w}
          height={box.h}
          rx={10}
          fill={boardTheme.task.fill}
          stroke={boardTheme.task.border}
          strokeWidth={1.5}
        />
        <text
          x={box.x + 12}
          y={box.y + 22}
          fontFamily={FONT}
          fontSize={12}
          fontWeight={700}
          fill={boardTheme.task.key}
        >
          {el.taskKey}
        </text>
        <text
          x={box.x + box.w - 12}
          y={box.y + 22}
          textAnchor="end"
          fontFamily={FONT}
          fontSize={11}
          fill={boardTheme.task.status}
        >
          {current}
        </text>
        {wrap(el.taskTitle ?? "", box.w - 24, 14)
          .slice(0, 3)
          .map((line, i) => (
            <text
              key={i}
              x={box.x + 12}
              y={box.y + 44 + i * 18}
              fontFamily={FONT}
              fontSize={14}
              fill={boardTheme.task.title}
            >
              {line}
            </text>
          ))}
      </g>
    );
  }

  if (el.type === "comment") {
    return (
      <g opacity={opacity}>
        <path
          d={`M${box.x} ${box.y + box.h} L${box.x} ${box.y + box.h / 2} A${box.w / 2} ${box.h / 2} 0 1 1 ${box.x + box.w / 2} ${box.y + box.h} Z`}
          fill={boardTheme.task.border}
          stroke={boardTheme.export.light.background}
          strokeWidth={2}
        />
        <text
          x={box.x + box.w / 2}
          y={box.y + box.h / 2 + 4}
          textAnchor="middle"
          fontFamily={FONT}
          fontSize={12}
          fontWeight={700}
          fill={boardTheme.export.light.background}
        >
          {(el.author ?? "?").slice(0, 1).toUpperCase()}
        </text>
      </g>
    );
  }

  if (el.type === "sticky") {
    return (
      <g opacity={opacity}>
        <rect
          x={box.x + 3}
          y={box.y + 4}
          width={box.w}
          height={box.h}
          rx={4}
          fill={boardTheme.shadow}
          opacity={0.08}
        />
        <rect
          x={box.x}
          y={box.y}
          width={box.w}
          height={box.h}
          rx={4}
          fill={fill === "none" ? boardTheme.stickies[0] : fill}
        />
        <Label el={el} live={live} inset={14} />
      </g>
    );
  }

  if (el.type === "text") {
    return (
      <g opacity={opacity}>
        <Label el={el} live={live} inset={2} />
      </g>
    );
  }

  const shape = outline(el);

  if (!shape) return null;

  let body: React.ReactNode;

  if (el.sketch) {
    body = (
      <>
        {fill !== "none" ? (
          <path d={smoothPen(shape.points) + "Z"} fill={fill} stroke="none" />
        ) : null}
        <path
          d={sketchPath(shape.points, true, el.id)}
          fill="none"
          {...common}
        />
      </>
    );
  } else if (el.type === "ellipse") {
    body = (
      <ellipse
        cx={box.x + box.w / 2}
        cy={box.y + box.h / 2}
        rx={box.w / 2}
        ry={box.h / 2}
        fill={fill}
        {...common}
      />
    );
  } else if (el.type === "diamond") {
    body = <path d={smoothPen(shape.points) + "Z"} fill={fill} {...common} />;
  } else {
    body = (
      <rect
        x={box.x}
        y={box.y}
        width={box.w}
        height={box.h}
        rx={el.rounded || el.type === "frame" ? 12 : 0}
        fill={fill}
        {...common}
      />
    );
  }

  return (
    <g opacity={opacity}>
      {body}
      {el.type === "frame" ? (
        <text
          x={box.x + 4}
          y={box.y - 8}
          fontFamily={FONT}
          fontSize={14}
          fontWeight={600}
          fill="currentColor"
          opacity={0.7}
        >
          {live ?? el.text ?? "Frame"}
        </text>
      ) : (
        <Label el={el} live={live} />
      )}
    </g>
  );
}
