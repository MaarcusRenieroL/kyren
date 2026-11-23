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
  type SQL,
} from "@kyren/db/drizzle";
import {
  files,
  mailAttachments,
  mailMessages,
  mailRecipients,
  members,
  users,
} from "@kyren/db/schema";
import { z } from "zod";
import { currentMemberId } from "../../chat";
import { likePattern } from "../../like";
import { uuid } from "../../zod-common";
import {
  PAGE,
  procedure,
  draftInput,
  type DraftInput,
  folders,
  snippet,
  nameMap,
} from "./helpers";

export const mailListProcedures = {
  list: procedure("mail.view")
    .input(
      z.object({
        folder: z.enum(folders),
        search: z.string().trim().max(120).optional(),
        /** The `nextCursor` of the previous page, for older messages. */
        cursor: z
          .string()
          .regex(
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
          )
          .optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const memberId = await currentMemberId(ctx);
      // Newest first, by time then id, so messages sent in the same
      // millisecond are never skipped or repeated between pages.
      const [cursorAt, cursorId] = input.cursor?.split("|") ?? [];
      const olderThan = (at: SQL) =>
        cursorAt
          ? sql`(date_trunc('milliseconds', ${at}) < ${cursorAt}::timestamp or (date_trunc('milliseconds', ${at}) = ${cursorAt}::timestamp and ${mailMessages.id} < ${cursorId}::uuid))`
          : undefined;
      const sentAt = sql`${mailMessages.sentAt}`;
      const shownAt = sql`coalesce(${mailMessages.sentAt}, ${mailMessages.updatedAt})`;
      const escaped = input.search?.replace(/[\\%_]/g, "\\$&");
      const match = escaped
        ? or(
            ilike(mailMessages.subject, `%${escaped}%`),
            ilike(mailMessages.body, `%${escaped}%`),
          )
        : undefined;
      const org = eq(mailMessages.organizationId, ctx.activeOrganization.id);

      type Item = {
        id: string;
        threadId: string;
        subject: string;
        snippet: string;
        senderId: string | null;
        toIds: string[];
        at: Date;
        unread: boolean;
        starred: boolean;
      };
      const items = new Map<string, Item>();
      const wantsReceived = ["inbox", "starred", "trash"].includes(
        input.folder,
      );
      const wantsSent = ["sent", "drafts", "starred", "trash"].includes(
        input.folder,
      );

      if (wantsReceived) {
        const rows = await ctx.db
          .select({ message: mailMessages, rec: mailRecipients })
          .from(mailRecipients)
          .innerJoin(
            mailMessages,
            eq(mailMessages.id, mailRecipients.messageId),
          )
          .where(
            and(
              org,
              match,
              eq(mailRecipients.memberId, memberId),
              isNotNull(mailMessages.sentAt),
              isNull(mailRecipients.purgedAt),
              input.folder === "trash"
                ? isNotNull(mailRecipients.trashedAt)
                : isNull(mailRecipients.trashedAt),
              input.folder === "starred"
                ? eq(mailRecipients.starred, true)
                : undefined,
              olderThan(sentAt),
            ),
          )
          .orderBy(
            desc(sql`date_trunc('milliseconds', ${sentAt})`),
            desc(mailMessages.id),
          )
          .limit(PAGE + 1);

        for (const { message, rec } of rows) {
          items.set(message.id, {
            id: message.id,
            threadId: message.threadId,
            subject: message.subject,
            snippet: snippet(message.body),
            senderId: message.senderMemberId,
            toIds: [],
            at: message.sentAt!,
            unread: !rec.readAt,
            starred: rec.starred,
          });
        }
      }

      if (wantsSent) {
        const rows = await ctx.db
          .select()
          .from(mailMessages)
          .where(
            and(
              org,
              match,
              eq(mailMessages.senderMemberId, memberId),
              isNull(mailMessages.senderPurgedAt),
              input.folder === "drafts"
                ? and(
                    isNull(mailMessages.sentAt),
                    isNull(mailMessages.senderTrashedAt),
                  )
                : isNotNull(mailMessages.sentAt),
              input.folder === "trash"
                ? isNotNull(mailMessages.senderTrashedAt)
                : isNull(mailMessages.senderTrashedAt),
              input.folder === "starred"
                ? eq(mailMessages.senderStarred, true)
                : undefined,
              olderThan(shownAt),
            ),
          )
          .orderBy(
            desc(sql`date_trunc('milliseconds', ${shownAt})`),
            desc(mailMessages.id),
          )
          .limit(PAGE + 1);

        for (const message of rows) {
          if (items.has(message.id)) continue;
          items.set(message.id, {
            id: message.id,
            threadId: message.threadId,
            subject: message.subject,
            snippet: snippet(message.body),
            senderId: message.senderMemberId,
            toIds: [],
            at: message.sentAt ?? message.updatedAt,
            unread: false,
            starred: message.senderStarred,
          });
        }
      }

      const sorted = [...items.values()].sort(
        (a, b) => +b.at - +a.at || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0),
      );
      const list = sorted.slice(0, PAGE);
      const last = list[list.length - 1];
      const nextCursor =
        sorted.length > PAGE && last
          ? `${last.at.toISOString()}|${last.id}`
          : null;
      const recipients = list.length
        ? await ctx.db
            .select({
              messageId: mailRecipients.messageId,
              memberId: mailRecipients.memberId,
              kind: mailRecipients.kind,
            })
            .from(mailRecipients)
            .where(
              inArray(
                mailRecipients.messageId,
                list.map((item) => item.id),
              ),
            )
        : [];

      for (const row of recipients) {
        if (row.kind === "to")
          items.get(row.messageId)?.toIds.push(row.memberId);
      }

      const names = await nameMap(ctx, [
        ...new Set(
          list.flatMap((item) => [
            ...(item.senderId ? [item.senderId] : []),
            ...item.toIds,
          ]),
        ),
      ]);
      const label = (id: string | null) =>
        (id && names.get(id)?.name) || "Someone";

      return {
        items: list.map((item) => ({
          id: item.id,
          threadId: item.threadId,
          subject: item.subject || "(no subject)",
          snippet: item.snippet,
          from: item.senderId === memberId ? "Me" : label(item.senderId),
          to: item.toIds.map(label),
          at: item.at.toISOString(),
          unread: item.unread,
          starred: item.starred,
          draft: input.folder === "drafts",
        })),
        nextCursor,
      };
    }),

  /** How many unread messages are waiting in the inbox. */
};
