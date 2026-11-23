import { TRPCError } from "@trpc/server";
import { and, desc, eq, isNotNull, isNull } from "@zentro/db/drizzle";
import { members, users, whiteboards } from "@zentro/db/schema";
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
  num,
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


export const whiteboardReadProcedures = {
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

};
