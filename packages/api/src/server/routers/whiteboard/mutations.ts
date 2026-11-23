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

import {
  boardElement,
  boardElements,
  type BoardElement,
  mergeBoard,
  title,
  tooLarge,
} from "./schema";

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


export const whiteboardMutationsProcedures = {
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
};
