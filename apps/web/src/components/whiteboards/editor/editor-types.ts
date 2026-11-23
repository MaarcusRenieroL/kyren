import {
  ArrowUpRightIcon,
  CircleIcon,
  DiamondIcon,
  FrameIcon,
  HandIcon,
  MessageSquareIcon,
  MinusIcon,
  MousePointer2Icon,
  PencilIcon,
  SquareIcon,
  StickyNoteIcon,
  TypeIcon,
} from "lucide-react";
import type { Box, Dash, El, Point } from "../canvas/model";

export type Tool =
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

export type View = { x: number; y: number; k: number };
export type Handle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

export type Drag =
  | { kind: "pan"; sx: number; sy: number; vx: number; vy: number }
  | { kind: "marquee"; from: Point; to: Point; additive: boolean }
  | { kind: "move"; from: Point; originals: Map<string, El> }
  | { kind: "resize"; handle: Handle; box: Box; originals: Map<string, El> }
  | { kind: "end"; id: string; which: "start" | "end" }
  | { kind: "draw"; id: string; from: Point }
  | { kind: "pen"; id: string };

export type SaveState = "saved" | "saving" | "dirty" | "error";

export type Other = {
  id: string;
  name: string;
  cursor: { x: number; y: number } | null;
};

export type BoardStyle = {
  color: string;
  fill: string;
  strokeWidth: number;
  dash: Dash;
  sketch: boolean;
  fontSize: number;
};

export const tools: {
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

export const handles: Handle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
export const POLL_MS = 3000;
export const PRESENCE_MS = 1500;

export const shortcuts: [string, string][] = [
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
