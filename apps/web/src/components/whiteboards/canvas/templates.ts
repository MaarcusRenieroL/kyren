import { boardTheme } from "@zentro/ui/lib/theme-colors";

import { newId, stickyColors, type El, type Point } from "./model";

export type Template = {
  id: string;
  name: string;
  description: string;
  build: (at: Point) => El[];
};

const frame = (
  x: number,
  y: number,
  w: number,
  h: number,
  text: string,
): El => ({
  id: newId(),
  type: "frame",
  x,
  y,
  w,
  h,
  text,
  color: boardTheme.frame,
  fill: "none",
  strokeWidth: 1,
  fontSize: 16,
  v: 1,
});

const sticky = (x: number, y: number, text: string, fill: string): El => ({
  id: newId(),
  type: "sticky",
  x,
  y,
  w: 180,
  h: 120,
  text,
  fill,
  color: boardTheme.text,
  fontSize: 16,
  v: 1,
});

const box = (
  type: "rect" | "ellipse" | "diamond",
  x: number,
  y: number,
  text: string,
): El => ({
  id: newId(),
  type,
  x,
  y,
  w: 180,
  h: 80,
  text,
  color: boardTheme.text,
  fill: boardTheme.neutralFill,
  strokeWidth: 2,
  rounded: type === "rect",
  fontSize: 16,
  v: 1,
});

const arrow = (from: El, to: El): El => ({
  id: newId(),
  type: "arrow",
  x: 0,
  y: 0,
  w: 0,
  h: 0,
  points: [0, 0, 1, 1],
  color: boardTheme.connector,
  strokeWidth: 2,
  start: { id: from.id },
  end: { id: to.id },
  v: 1,
});

/** Columns of frames, each with a starter note, laid out from `at`. */
function columns(at: Point, titles: string[], width = 320, height = 520) {
  return titles.flatMap((title, i) => {
    const x = at.x + i * (width + 40);

    return [
      frame(x, at.y, width, height, title),
      sticky(x + 30, at.y + 40, "", stickyColors[i % stickyColors.length]!),
    ];
  });
}

export const templates: Template[] = [
  {
    id: "retro",
    name: "Retrospective",
    description: "What went well, what to improve, and actions.",
    build: (at) => columns(at, ["Went well", "To improve", "Actions"]),
  },
  {
    id: "kanban",
    name: "Kanban",
    description: "To do, doing and done columns for sticky notes.",
    build: (at) => columns(at, ["To do", "Doing", "Done"]),
  },
  {
    id: "flowchart",
    name: "Flowchart",
    description: "Start, a step and a decision, already connected.",
    build: (at) => {
      const start = box("ellipse", at.x, at.y, "Start");
      const step = box("rect", at.x, at.y + 160, "Do the thing");
      const decision = box("diamond", at.x, at.y + 320, "Done?");
      const end = box("ellipse", at.x + 300, at.y + 320, "End");

      return [
        start,
        step,
        decision,
        end,
        arrow(start, step),
        arrow(step, decision),
        arrow(decision, end),
      ];
    },
  },
  {
    id: "brainstorm",
    name: "Brainstorm",
    description: "A central question with ideas around it.",
    build: (at) => {
      const middle = box("ellipse", at.x, at.y, "Our question");
      const ideas = Array.from({ length: 6 }, (_, i) => {
        const angle = (i / 6) * Math.PI * 2;

        return sticky(
          at.x + Math.cos(angle) * 320,
          at.y + Math.sin(angle) * 240 - 20,
          "",
          stickyColors[i % stickyColors.length]!,
        );
      });

      return [middle, ...ideas, ...ideas.map((idea) => arrow(middle, idea))];
    },
  },
  {
    id: "weekly",
    name: "Weekly plan",
    description: "A frame for each working day.",
    build: (at) =>
      columns(
        at,
        ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        240,
        440,
      ),
  },
];
