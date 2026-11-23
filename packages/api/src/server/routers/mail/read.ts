import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, inArray, isNotNull, isNull, or, sql } from "@zentro/db/drizzle";
import {
  files,
  mailAttachments,
  mailMessages,
  mailRecipients,
  members,
  users,
} from "@zentro/db/schema";
import { z } from "zod";
import { currentMemberId } from "../../chat";
import { likePattern } from "../../like";
import { uuid } from "../../zod-common";
import {
  procedure,
  visibleMessage,
  nameMap,
} from "./helpers";

export const mailReadProcedures = {
  unread: procedure("mail.view").query(async ({ ctx }) => {
    const memberId = await currentMemberId(ctx);
    const [row] = await ctx.db
      .select({ count: sql<number>`count(*)::int` })
      .from(mailRecipients)
      .innerJoin(mailMessages, eq(mailMessages.id, mailRecipients.messageId))
      .where(
        and(
          eq(mailRecipients.memberId, memberId),
          eq(mailMessages.organizationId, ctx.activeOrganization.id),
          isNull(mailRecipients.readAt),
          isNull(mailRecipients.trashedAt),
          isNull(mailRecipients.purgedAt),
          isNotNull(mailMessages.sentAt),
        ),
      );

    return { count: row?.count ?? 0 };
  }),

  /** People who can be addressed. */
  people: procedure("mail.view").query(async ({ ctx }) => {
    const memberId = await currentMemberId(ctx);
    const rows = await ctx.db
      .select({ id: members.id, name: users.name, email: users.email })
      .from(members)
      .innerJoin(users, eq(users.id, members.userId))
      .where(eq(members.organizationId, ctx.activeOrganization.id))
      .orderBy(asc(users.name));

    return rows.map((row) => ({ ...row, isMe: row.id === memberId }));
  }),

  /** One conversation as the caller can see it; marks it read. */
  get: procedure("mail.view")
    .input(z.object({ id: uuid }))
    .query(async ({ ctx, input }) => {
      const memberId = await currentMemberId(ctx);
      const first = await visibleMessage(ctx, memberId, input.id);

      if (!first) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Message not found.",
        });
      }

      const thread = await ctx.db
        .select({ id: mailMessages.id })
        .from(mailMessages)
        .where(
          and(
            eq(mailMessages.threadId, first.message.threadId),
            eq(mailMessages.organizationId, ctx.activeOrganization.id),
          ),
        );
      const messages = (
        await Promise.all(
          thread.map((row) => visibleMessage(ctx, memberId, row.id)),
        )
      )
        .filter((item): item is NonNullable<typeof item> => item !== null)
        .filter((item) => item.message.sentAt || item.message.id === input.id)
        .sort(
          (a, b) =>
            +(a.message.sentAt ?? a.message.updatedAt) -
            +(b.message.sentAt ?? b.message.updatedAt),
        );

      const unreadIds = messages
        .filter((item) => item.asRecipient && !item.asRecipient.readAt)
        .map((item) => item.asRecipient!.id);

      if (unreadIds.length) {
        await ctx.db
          .update(mailRecipients)
          .set({ readAt: new Date() })
          .where(inArray(mailRecipients.id, unreadIds));
      }

      const names = await nameMap(ctx, [
        ...new Set(
          messages.flatMap((item) => [
            ...(item.message.senderMemberId
              ? [item.message.senderMemberId]
              : []),
            ...item.recipients.map((row) => row.memberId),
          ]),
        ),
      ]);
      const attached = messages.length
        ? await ctx.db
            .select({
              messageId: mailAttachments.messageId,
              id: files.id,
              name: files.name,
              size: files.size,
              mimeType: files.mimeType,
            })
            .from(mailAttachments)
            .innerJoin(files, eq(files.id, mailAttachments.fileId))
            .where(
              and(
                inArray(
                  mailAttachments.messageId,
                  messages.map((item) => item.message.id),
                ),
                isNull(files.deletedAt),
              ),
            )
            .orderBy(asc(mailAttachments.position))
        : [];
      const person = (id: string) => ({
        id,
        name: names.get(id)?.name ?? "Someone",
        email: names.get(id)?.email ?? "",
      });

      return {
        subject: first.message.subject || "(no subject)",
        messages: messages.map((item) => ({
          id: item.message.id,
          from: item.message.senderMemberId
            ? person(item.message.senderMemberId)
            : { id: "", name: "Someone", email: "" },
          to: item.recipients
            .filter((row) => row.kind === "to")
            .map((row) => person(row.memberId)),
          cc: item.recipients
            .filter((row) => row.kind === "cc")
            .map((row) => person(row.memberId)),
          subject: item.message.subject,
          body: item.message.body,
          at: (item.message.sentAt ?? item.message.updatedAt).toISOString(),
          draft: !item.message.sentAt,
          mine: item.mine,
          attachments: attached
            .filter((file) => file.messageId === item.message.id)
            .map((file) => ({
              id: file.id,
              name: file.name,
              size: file.size,
              mimeType: file.mimeType,
              url: `/api/files/${file.id}`,
            })),
        })),
      };
    }),

};
