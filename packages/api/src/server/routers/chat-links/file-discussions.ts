import { TRPCError } from "@trpc/server";
import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
} from "@kyren/db/drizzle";
import {
  chatAttachments,
  chatChannels,
  chatMembers,
  chatMessages,
  docs,
  files,
  projects,
  tasks,
} from "@kyren/db/schema";
import { z } from "zod";
import { visibleDocsCondition } from "../../access";
import {
  currentMemberId,
  memberProfiles,
  normalizeChannelName,
  plainBody,
  readableChannelIds,
} from "../../chat";
import {
  chatProcedure,
  viewableItem,
  itemIdFromRef,
  discussionChannel,
  uuid,
  itemType,
  type Item,
} from "./helpers";
import { likePattern } from "../../like";

export const chatLinksFileDiscussionsProcedures = {
  fileDiscussions: chatProcedure("chat.view")
    .input(z.object({ fileId: uuid }))
    .query(async ({ ctx, input }) => {
      const memberId = await currentMemberId(ctx);
      const readable = await readableChannelIds(ctx, memberId);

      if (!readable.length) return [];

      const rows = await ctx.db
        .select({
          messageId: chatMessages.id,
          channelId: chatChannels.id,
          channelName: chatChannels.name,
          kind: chatChannels.kind,
          at: chatMessages.createdAt,
        })
        .from(chatAttachments)
        .innerJoin(chatMessages, eq(chatMessages.id, chatAttachments.messageId))
        .innerJoin(chatChannels, eq(chatChannels.id, chatMessages.channelId))
        .where(
          and(
            eq(chatAttachments.fileId, input.fileId),
            inArray(chatMessages.channelId, readable),
            isNull(chatMessages.deletedAt),
          ),
        )
        .orderBy(desc(chatMessages.createdAt))
        .limit(20);

      return rows.map((row) => ({
        ...row,
        kind: row.kind as "channel" | "dm",
      }));
    }),

  /** Tasks with the most chat around them, for the overview. */
  mostDiscussed: chatProcedure("chat.view", { also: ["tasks.view"] }).query(
    async ({ ctx }) => {
      const memberId = await currentMemberId(ctx);
      const readable = await readableChannelIds(ctx, memberId);
      const viewable = await ctx.permissions.viewableProjectIds("tasks.view");

      if (!readable.length || !viewable.length) return [];

      const rows = await ctx.db.execute(sql`
        select t."key", t."name", t."status", count(distinct m.id)::int as messages
        from "workLink" l
        join "chatMessage" m on m.id = l."sourceId" and l."sourceType" = 'message'
        join "task" t on t.id = l."targetId" and l."targetType" = 'task'
        where l."organizationId" = ${ctx.activeOrganization.id}
          and m."deletedAt" is null
          and m."createdAt" > now() - interval '30 days'
          and m."channelId" in (${sql.join(
            readable.map((id) => sql`${id}`),
            sql`, `,
          )})
          and t."projectId" in (${sql.join(
            viewable.map((id) => sql`${id}`),
            sql`, `,
          )})
          and t."deletedAt" is null
        group by t."key", t."name", t."status"
        order by messages desc
        limit 5
      `);

      return (
        rows as unknown as {
          rows: Array<{
            key: string;
            name: string;
            status: string;
            messages: number;
          }>;
        }
      ).rows;
    },
  ),
};
