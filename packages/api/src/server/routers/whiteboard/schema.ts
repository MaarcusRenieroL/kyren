import { TRPCError } from "@trpc/server";
import { and, desc, eq, isNotNull, isNull } from "@kyren/db/drizzle";
import { members, users, whiteboards } from "@kyren/db/schema";
import { z } from "zod";

import { holdsOwn } from "../../access";
import { currentMemberId } from "../../chat";
import { permissionProcedure, router, type OrganizationContext } from "../../trpc";

const uuid = z.string().uuid();

const procedure = (permission: string, audit?: string[], also?: string[]) =>
  permissionProcedure(permission, undefined, {
    module: "whiteboards",
    audit,
    also,
  });

export const num = z.number().finite().min(-1e6).max(1e6);

const colour = z
  .string()
  .regex(/^(ink|#[0-9a-f]{3,8})$/i, "Use a palette colour.");

/**
 * One shape on the canvas. Points are flat [x, y, x, y, …] pairs relative to
 * x, y. `v` is the shape's own version: saves merge shape by shape, the higher
 * version winning, and a deleted shape stays as a marker so a merge can't
 * bring it back.
 */
export const boardElement = z.object({
  id: z.string().min(1).max(40),
  type: z.enum([
    "pen",
    "rect",
    "ellipse",
    "diamond",
    "line",
    "arrow",
    "text",
    "sticky",
    "task",
    "frame",
    "image",
    "comment",
  ]),
  x: num,
  y: num,
  w: num.default(0),
  h: num.default(0),
  points: z.array(num).max(6000).optional(),
  color: colour.default("#1f2937"),
  fill: z
    .string()
    .regex(/^(none|ink|#[0-9a-f]{3,8})$/i, "Use a palette colour.")
    .optional(),
  strokeWidth: z.number().min(1).max(16).optional(),
  dash: z.enum(["solid", "dashed", "dotted"]).optional(),
  opacity: z.number().min(0.1).max(1).optional(),
  rounded: z.boolean().optional(),
  sketch: z.boolean().optional(),
  fontSize: z.number().min(8).max(120).optional(),
  align: z.enum(["left", "center", "right"]).optional(),
  text: z.string().max(5000).optional(),
  groupId: z.string().max(40).optional(),
  locked: z.boolean().optional(),
  /** Arrows and lines attached to shapes follow them when they move. */
  start: z.object({ id: z.string().max(40) }).optional(),
  end: z.object({ id: z.string().max(40) }).optional(),
  elbow: z.boolean().optional(),
  /** An image on the board: a file from the organization's Files. */
  fileId: z.string().uuid().optional(),
  /** Who wrote a comment pinned to the board. */
  author: z.string().max(120).optional(),
  taskKey: z.string().max(30).optional(),
  taskTitle: z.string().max(200).optional(),
  taskStatus: z.string().max(50).optional(),
  taskPriority: z.string().max(50).optional(),
  /** Stacking order: higher is drawn on top. */
  z: z.number().finite().min(-1e9).max(1e9).optional(),
  v: z.number().int().min(0).max(1e9).optional(),
  deleted: z.boolean().optional(),
});

export type BoardElement = z.infer<typeof boardElement>;

/** Shapes on one board, not counting deleted markers. */
const MAX_LIVE = 5000;
/** Deleted markers are tiny, but they are capped too. */
const MAX_ALL = 20_000;
const MAX_POINTS = 100_000;
const MAX_TEXT = 1_000_000;

export const tooLarge = "That drawing is too large to save.";

/**
 * A whole drawing. The budgets count only shapes still on the board, so
 * erasing frees room; deleted markers carry no points or text.
 */
export const boardElements = z
  .array(boardElement)
  .max(MAX_ALL, tooLarge)
  .superRefine((elements, ctx) => {
    let shapes = 0;
    let points = 0;
    let text = 0;

    for (const element of elements) {
      if (element.deleted) continue;
      shapes += 1;
      points += element.points?.length ?? 0;
      text += (element.text?.length ?? 0) + (element.taskTitle?.length ?? 0);
    }

    if (shapes > MAX_LIVE || points > MAX_POINTS || text > MAX_TEXT) {
      ctx.addIssue({ code: "custom", message: tooLarge });
    }
  });

/** A deleted shape keeps only what a merge needs: which one, and when. */
export function tombstone(element: BoardElement): BoardElement {
  return {
    id: element.id,
    type: element.type,
    x: 0,
    y: 0,
    w: 0,
    h: 0,
    color: "ink",
    v: element.v,
    deleted: true,
  };
}

/**
 * The board after a save: everyone's shapes, each in its newest version.
 * On a tie the stored copy stays, so the same save twice changes nothing.
 */
export function mergeBoard(stored: BoardElement[], incoming: BoardElement[]) {
  const merged = new Map(stored.map((element) => [element.id, element]));

  for (const element of incoming) {
    const current = merged.get(element.id);

    if (!current || (element.v ?? 0) > (current.v ?? 0)) {
      merged.set(element.id, element);
    }
  }

  return [...merged.values()].map((element) =>
    element.deleted ? tombstone(element) : element,
  );
}

export const title = z.string().trim().min(1, "Give the board a title.").max(120);
