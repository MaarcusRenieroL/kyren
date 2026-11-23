import {
  and,
  desc,
  eq,
  inArray,
  isNull,
  like,
  or,
  sql,
} from "@zentro/db/drizzle";
import { activityEvents, users } from "@zentro/db/schema";
import { z } from "zod";

import { cursorCondition, cursorSchema, encodeCursor } from "../../activity";
import { permissionProcedure, router } from "../../trpc";
import { permissionLogActions, uuid } from "./types";

export const logRouter = router({
  list: permissionProcedure("permissions.log.view")
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(100).default(30),
          cursor: cursorSchema.optional(),
          actorUserId: uuid.optional(),
          targetType: z.string().max(64).optional(),
          targetId: z.string().max(64).optional(),
        })
        .default({ limit: 30 }),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(activityEvents.organizationId, ctx.activeOrganization.id),
        or(
          ...permissionLogActions.map((pattern) =>
            like(activityEvents.action, pattern),
          ),
        ),
        cursorCondition(input.cursor),
      ];

      if (!(await ctx.permissions.can("projects.view_private"))) {
        const visible =
          await ctx.permissions.viewableProjectIds("projects.view");

        conditions.push(
          or(
            isNull(activityEvents.projectId),
            visible.length
              ? inArray(activityEvents.projectId, visible)
              : sql`false`,
          )!,
        );
      }

      if (input.actorUserId) {
        conditions.push(eq(activityEvents.actorUserId, input.actorUserId));
      }

      if (input.targetType) {
        conditions.push(eq(activityEvents.targetType, input.targetType));
      }

      if (input.targetId) {
        conditions.push(eq(activityEvents.targetId, input.targetId));
      }

      const rows = await ctx.db
        .select({
          id: activityEvents.id,
          action: activityEvents.action,
          targetType: activityEvents.targetType,
          targetId: activityEvents.targetId,
          targetLabel: activityEvents.targetLabel,
          metadata: activityEvents.metadata,
          createdAt: activityEvents.createdAt,
          actorUserId: activityEvents.actorUserId,
          actorName: users.name,
        })
        .from(activityEvents)
        .leftJoin(users, eq(users.id, activityEvents.actorUserId))
        .where(and(...conditions))
        .orderBy(desc(activityEvents.createdAt), desc(activityEvents.id))
        .limit(input.limit + 1);

      const hasMore = rows.length > input.limit;
      const items = (hasMore ? rows.slice(0, input.limit) : rows).map(
        ({ metadata, ...row }) => ({
          ...row,
          before: metadata?.before ?? null,
          after: metadata?.after ?? null,
          metadata,
        }),
      );

      return {
        items,
        nextCursor: hasMore ? encodeCursor(items[items.length - 1]!) : null,
      };
    }),
});
