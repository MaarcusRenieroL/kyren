import { TRPCError } from "@trpc/server";
import { and, desc, eq, isNotNull, isNull } from "@zentro/db/drizzle";
import { members, users, whiteboards } from "@zentro/db/schema";
import { z } from "zod";

import { holdsOwn } from "../access";
import { currentMemberId } from "../chat";
import { permissionProcedure, router, type OrganizationContext } from "../trpc";

const uuid = z.string().uuid();

const procedure = (permission: string, audit?: string[], also?: string[]) =>
  permissionProcedure(permission, undefined, {
    module: "whiteboards",
    audit,
    also,
  });

const num = z.number().finite().min(-1e6).max(1e6);

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

const tooLarge = "That drawing is too large to save.";

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

const title = z.string().trim().min(1, "Give the board a title.").max(120);

async function manageable(
  ctx: OrganizationContext,
  id: string,
  { trashed = false }: { trashed?: boolean } = {},
) {
  const memberId = await currentMemberId(ctx);
  const [board] = await ctx.db
    .select({
      id: whiteboards.id,
      title: whiteboards.title,
      createdByMemberId: whiteboards.createdByMemberId,
    })
    .from(whiteboards)
    .where(
      and(
        eq(whiteboards.id, id),
        eq(whiteboards.organizationId, ctx.activeOrganization.id),
        trashed
          ? isNotNull(whiteboards.deletedAt)
          : isNull(whiteboards.deletedAt),
      ),
    )
    .limit(1);

  if (!board) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Board not found." });
  }

  const allowed =
    (await ctx.permissions.can("whiteboards.delete_any")) ||
    (board.createdByMemberId === memberId &&
      (await holdsOwn(ctx, "whiteboards.delete_own")));

  if (!allowed) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You can only change boards you created.",
    });
  }

  return board;
}

/** Who has each board open: board id → member id → name and last seen. */
const viewers = new Map<
  string,
  Map<
    string,
    { name: string; at: number; cursor: { x: number; y: number } | null }
  >
>();
/** Someone is "here" until 20 seconds after their last check-in. */
const PRESENCE_MS = 20_000;

export const whiteboardRouter = router({
  /**
   * Checks in as looking at a board and returns everyone else looking at it.
   * Kept in this server's memory: it is a passing signal, not a record.
   */
  presence: procedure("whiteboards.view")
    .input(
      z.object({
        id: uuid,
        /** Where this person's pointer is on the board, if over it. */
        cursor: z.object({ x: num, y: num }).nullable().default(null),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [board] = await ctx.db
        .select({ id: whiteboards.id })
        .from(whiteboards)
        .where(
          and(
            eq(whiteboards.id, input.id),
            eq(whiteboards.organizationId, ctx.activeOrganization.id),
            isNull(whiteboards.deletedAt),
          ),
        )
        .limit(1);

      if (!board) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Board not found." });
      }

      const memberId = await currentMemberId(ctx);
      const now = Date.now();
      const here = viewers.get(board.id) ?? new Map();

      here.set(memberId, {
        name: ctx.user.name || ctx.user.email,
        at: now,
        cursor: input.cursor,
      });

      viewers.set(board.id, here);

      // Forget everyone who has gone quiet, on every board, and boards
      // nobody is on, so the map only holds people looking right now.
      for (const [boardId, people] of viewers) {
        for (const [id, seen] of people) {
          if (now - seen.at > PRESENCE_MS) people.delete(id);
        }
        if (!people.size) viewers.delete(boardId);
      }

      return [...here.entries()]
        .filter(([id]) => id !== memberId)
        .map(([id, seen]) => ({ id, name: seen.name, cursor: seen.cursor }));
    }),

  list: procedure("whiteboards.view", undefined, [
    "whiteboards.delete_own",
    "whiteboards.delete_any",
  ]).query(async ({ ctx }) => {
    const memberId = await currentMemberId(ctx);
    const any = await ctx.permissions.can("whiteboards.delete_any");
    const own = await holdsOwn(ctx, "whiteboards.delete_own");

    const rows = await ctx.db
      .select({
        id: whiteboards.id,
        title: whiteboards.title,
        updatedAt: whiteboards.updatedAt,
        createdByMemberId: whiteboards.createdByMemberId,
        creator: users.name,
      })
      .from(whiteboards)
      .leftJoin(members, eq(members.id, whiteboards.createdByMemberId))
      .leftJoin(users, eq(users.id, members.userId))
      .where(
        and(
          eq(whiteboards.organizationId, ctx.activeOrganization.id),
          isNull(whiteboards.deletedAt),
        ),
      )
      .orderBy(desc(whiteboards.updatedAt))
      .limit(200);

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      updatedAt: row.updatedAt.toISOString(),
      createdBy: row.creator ?? null,
      canManage: any || (own && row.createdByMemberId === memberId),
    }));
  }),

  /**
   * When the drawing last changed. Open editors ask this every few seconds
   * and fetch the whole board only when it moved.
   */
  version: procedure("whiteboards.view")
    .input(z.object({ id: uuid }))
    .query(async ({ ctx, input }) => {
      const [board] = await ctx.db
        .select({ updatedAt: whiteboards.updatedAt })
        .from(whiteboards)
        .where(
          and(
            eq(whiteboards.id, input.id),
            eq(whiteboards.organizationId, ctx.activeOrganization.id),
            isNull(whiteboards.deletedAt),
          ),
        )
        .limit(1);

      if (!board) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Board not found." });
      }

      return { updatedAt: board.updatedAt.toISOString() };
    }),

  get: procedure("whiteboards.view")
    .input(z.object({ id: uuid }))
    .query(async ({ ctx, input }) => {
      const [board] = await ctx.db
        .select()
        .from(whiteboards)
        .where(
          and(
            eq(whiteboards.id, input.id),
            eq(whiteboards.organizationId, ctx.activeOrganization.id),
            isNull(whiteboards.deletedAt),
          ),
        )
        .limit(1);

      if (!board) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Board not found." });
      }

      // An unreadable drawing must not open as a blank board: the next
      // autosave would overwrite what is still stored.
      const parsed = z.array(boardElement).safeParse(board.elements);

      if (!parsed.success) {
        console.error(`Whiteboard ${board.id} holds unreadable data`);

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            "This board's data couldn't be read. It has not been changed.",
        });
      }

      return {
        id: board.id,
        title: board.title,
        elements: parsed.data,
        updatedAt: board.updatedAt.toISOString(),
        canEdit: await ctx.permissions.can("whiteboards.edit"),
        /** The viewer's own name, for the comments they pin. */
        viewerName: ctx.user.name || ctx.user.email,
      };
    }),

  create: procedure("whiteboards.edit", ["whiteboard.created"])
    .input(z.object({ title }))
    .mutation(async ({ ctx, input }) => {
      const memberId = await currentMemberId(ctx);
      const id = await ctx.db.transaction(async (tx) => {
        const [row] = await tx
          .insert(whiteboards)
          .values({
            title: input.title,
            organizationId: ctx.activeOrganization.id,
            createdByMemberId: memberId,
          })
          .returning({ id: whiteboards.id });

        await ctx.audit.record(tx, {
          action: "whiteboard.created",
          target: { id: row!.id, label: input.title },
        });

        return row!.id;
      });

      return { id };
    }),

  /**
   * Saves the drawing. Anyone who can edit boards may draw on any board.
   * Shapes merge one by one with what is stored (newest version of each
   * wins), so two people drawing at once both keep their work. Returns the
   * merged board for the editor to take in what others drew.
   */
  save: procedure("whiteboards.edit")
    .input(z.object({ id: uuid, elements: boardElements }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.transaction(async (tx) => {
        const [board] = await tx
          .select({ id: whiteboards.id, elements: whiteboards.elements })
          .from(whiteboards)
          .where(
            and(
              eq(whiteboards.id, input.id),
              eq(whiteboards.organizationId, ctx.activeOrganization.id),
              // A board in the trash takes no more drawing.
              isNull(whiteboards.deletedAt),
            ),
          )
          .limit(1)
          .for("update");

        if (!board) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Board not found.",
          });
        }

        const stored = z.array(boardElement).safeParse(board.elements);

        // Never merge into data that can't be read: it would be overwritten.
        if (!stored.success) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message:
              "This board's data couldn't be read. It has not been changed.",
          });
        }

        // A comment is signed by whoever first pinned it, as the server
        // knows them, never by a name the editor sends.
        const signer = ctx.user.name || ctx.user.email;
        const authors = new Map(
          stored.data
            .filter((element) => element.type === "comment")
            .map((element) => [element.id, element.author]),
        );
        const incoming = input.elements.map((element) =>
          element.type === "comment" && !element.deleted
            ? { ...element, author: authors.get(element.id) ?? signer }
            : element,
        );
        const merged = boardElements.safeParse(
          mergeBoard(stored.data, incoming),
        );

        if (!merged.success) {
          throw new TRPCError({ code: "BAD_REQUEST", message: tooLarge });
        }

        const elements = merged.data;
        const savedAt = new Date();

        await tx
          .update(whiteboards)
          .set({ elements, updatedAt: savedAt })
          .where(eq(whiteboards.id, board.id));

        return { elements, savedAt: savedAt.toISOString() };
      });
    }),

  rename: procedure(
    "whiteboards.view",
    ["whiteboard.renamed"],
    ["whiteboards.delete_own", "whiteboards.delete_any"],
  )
    .input(z.object({ id: uuid, title }))
    .mutation(async ({ ctx, input }) => {
      const board = await manageable(ctx, input.id);

      await ctx.db.transaction(async (tx) => {
        await tx
          .update(whiteboards)
          // The title is not part of the drawing's version, so renaming
          // never makes someone's open editor think the board changed.
          .set({ title: input.title })
          .where(eq(whiteboards.id, board.id));
        await ctx.audit.record(tx, {
          action: "whiteboard.renamed",
          target: { id: board.id, label: input.title },
        });
      });

      return { id: board.id };
    }),

  remove: procedure(
    "whiteboards.view",
    ["whiteboard.deleted"],
    ["whiteboards.delete_own", "whiteboards.delete_any"],
  )
    .input(z.object({ id: uuid }))
    .mutation(async ({ ctx, input }) => {
      const board = await manageable(ctx, input.id);

      await ctx.db.transaction(async (tx) => {
        // Into the trash: it can be restored from there.
        await tx
          .update(whiteboards)
          .set({ deletedAt: new Date() })
          .where(eq(whiteboards.id, board.id));
        await ctx.audit.record(tx, {
          action: "whiteboard.deleted",
          target: { id: board.id, label: board.title },
        });
      });

      return { id: board.id };
    }),

  /** Boards in the trash that the caller could have deleted. */
  trash: procedure("whiteboards.view", undefined, [
    "whiteboards.delete_own",
    "whiteboards.delete_any",
  ]).query(async ({ ctx }) => {
    const any = await ctx.permissions.can("whiteboards.delete_any");
    const own = await holdsOwn(ctx, "whiteboards.delete_own");

    if (!any && !own) return [];

    const memberId = await currentMemberId(ctx);
    const rows = await ctx.db
      .select({
        id: whiteboards.id,
        title: whiteboards.title,
        deletedAt: whiteboards.deletedAt,
      })
      .from(whiteboards)
      .where(
        and(
          eq(whiteboards.organizationId, ctx.activeOrganization.id),
          isNotNull(whiteboards.deletedAt),
          any ? undefined : eq(whiteboards.createdByMemberId, memberId),
        ),
      )
      .orderBy(desc(whiteboards.deletedAt))
      .limit(100);

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      deletedAt: row.deletedAt!.toISOString(),
    }));
  }),

  /** Brings a board back from the trash. Whoever could delete it may. */
  restore: procedure(
    "whiteboards.view",
    ["whiteboard.restored"],
    ["whiteboards.delete_own", "whiteboards.delete_any"],
  )
    .input(z.object({ id: uuid }))
    .mutation(async ({ ctx, input }) => {
      const board = await manageable(ctx, input.id, { trashed: true });

      await ctx.db.transaction(async (tx) => {
        await tx
          .update(whiteboards)
          .set({ deletedAt: null })
          .where(eq(whiteboards.id, board.id));
        await ctx.audit.record(tx, {
          action: "whiteboard.restored",
          target: { id: board.id, label: board.title },
        });
      });

      return { id: board.id };
    }),
});
