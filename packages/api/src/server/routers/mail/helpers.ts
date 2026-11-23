import { randomUUID } from "node:crypto";

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
} from "@zentro/db/drizzle";
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
import { permissionProcedure, router, type OrganizationContext } from "../../trpc";

export const uuid = z.string().uuid();
export const folders = ["inbox", "starred", "sent", "drafts", "trash"] as const;

/** Messages per page of a folder. */
export const PAGE = 50;

export const procedure = (permission: string) =>
  permissionProcedure(permission, undefined, { module: "mail" });

export const draftInput = z.object({
  id: uuid.optional(),
  to: z.array(uuid).max(50).default([]),
  cc: z.array(uuid).max(50).default([]),
  subject: z.string().max(300).default(""),
  body: z.string().max(50_000).default(""),
  replyToId: uuid.optional(),
  /** Files uploaded for this message (see `files.mailRegister`). */
  fileIds: z.array(uuid).max(10).default([]),
});

export type DraftInput = z.infer<typeof draftInput>;

export async function nameMap(ctx: OrganizationContext, ids: string[]) {
  if (!ids.length) return new Map<string, { name: string; email: string }>();

  const rows = await ctx.db
    .select({ id: members.id, name: users.name, email: users.email })
    .from(members)
    .innerJoin(users, eq(users.id, members.userId))
    .where(
      and(
        eq(members.organizationId, ctx.activeOrganization.id),
        inArray(members.id, ids),
      ),
    );

  return new Map(rows.map((row) => [row.id, row]));
}

export const snippet = (body: string) =>
  body.replace(/\s+/g, " ").trim().slice(0, 140);

/** Whether the caller may read a message (they wrote it, or received it sent). */
export async function canSeeMessage(
  ctx: OrganizationContext,
  memberId: string,
  id: string,
) {
  return Boolean(await visibleMessage(ctx, memberId, id));
}

/** The message when the caller wrote it or received it once it was sent. */
export async function visibleMessage(
  ctx: OrganizationContext,
  memberId: string,
  id: string,
) {
  const [message] = await ctx.db
    .select()
    .from(mailMessages)
    .where(
      and(
        eq(mailMessages.id, id),
        eq(mailMessages.organizationId, ctx.activeOrganization.id),
      ),
    )
    .limit(1);

  if (!message) return null;

  const mine = message.senderMemberId === memberId;
  const recipients = await ctx.db
    .select()
    .from(mailRecipients)
    .where(eq(mailRecipients.messageId, id));
  const asRecipient = recipients.find((row) => row.memberId === memberId);

  // "Delete forever" removes it from that person's view for good.
  const asSender = mine && !message.senderPurgedAt;
  const asReader = asRecipient && message.sentAt && !asRecipient.purgedAt;

  if (!asSender && !asReader) return null;

  return { message, recipients, mine, asRecipient };
}

export async function writeMessage(
  ctx: OrganizationContext,
  input: DraftInput,
  send: boolean,
) {
  const memberId = await currentMemberId(ctx);
  const recipientIds = [...new Set([...input.to, ...input.cc])];

  if (recipientIds.length) {
    const known = await nameMap(ctx, recipientIds);

    if (known.size !== recipientIds.length) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Some recipients are not in this organization.",
      });
    }
  }

  if (send && !input.to.length) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Add at least one recipient.",
    });
  }

  if (send && !input.subject.trim() && !input.body.trim()) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Write a subject or a message first.",
    });
  }

  const existingId = input.id;
  const id = existingId ?? randomUUID();
  let threadId: string | undefined;

  if (input.replyToId) {
    const original = await visibleMessage(ctx, memberId, input.replyToId);

    if (!original) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Message not found." });
    }

    threadId = original.message.threadId;
  }

  // Only files this person uploaded for mail, in this organization.
  const fileIds = [...new Set(input.fileIds)];

  if (fileIds.length) {
    const own = await ctx.db
      .select({ id: files.id })
      .from(files)
      .where(
        and(
          inArray(files.id, fileIds),
          eq(files.organizationId, ctx.activeOrganization.id),
          eq(files.uploadedByMemberId, memberId),
          eq(files.source, "mail"),
          isNull(files.deletedAt),
        ),
      );

    if (own.length !== fileIds.length) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Attach files you uploaded to this message.",
      });
    }
  }

  const now = new Date();
  const values = {
    subject: input.subject.trim(),
    body: input.body,
    updatedAt: now,
    ...(send ? { sentAt: now } : {}),
  };

  // Message and recipients change together or not at all.
  await ctx.db.transaction(async (tx) => {
    if (existingId) {
      // "Still a draft" is checked by the write itself, so an autosave that
      // lands after the message was sent changes nothing.
      const [draft] = await tx
        .update(mailMessages)
        .set(values)
        .where(
          and(
            eq(mailMessages.id, id),
            eq(mailMessages.organizationId, ctx.activeOrganization.id),
            eq(mailMessages.senderMemberId, memberId),
            isNull(mailMessages.sentAt),
          ),
        )
        .returning({ id: mailMessages.id });

      if (!draft) {
        // Only the sender learns that their own message went out already.
        const [own] = await tx
          .select({ id: mailMessages.id })
          .from(mailMessages)
          .where(
            and(
              eq(mailMessages.id, id),
              eq(mailMessages.organizationId, ctx.activeOrganization.id),
              eq(mailMessages.senderMemberId, memberId),
            ),
          )
          .limit(1);

        throw own
          ? new TRPCError({
              code: "CONFLICT",
              message: "This message was already sent, so it can't be changed.",
            })
          : new TRPCError({ code: "NOT_FOUND", message: "Draft not found." });
      }

      await tx.delete(mailRecipients).where(eq(mailRecipients.messageId, id));
    } else {
      await tx.insert(mailMessages).values({
        id,
        organizationId: ctx.activeOrganization.id,
        senderMemberId: memberId,
        threadId: threadId ?? id,
        ...values,
      });
    }

    const rows = [
      ...input.to.map((memberIdValue) => ({
        memberId: memberIdValue,
        kind: "to",
      })),
      ...input.cc
        .filter((value) => !input.to.includes(value))
        .map((memberIdValue) => ({ memberId: memberIdValue, kind: "cc" })),
    ];

    if (rows.length) {
      await tx
        .insert(mailRecipients)
        .values(rows.map((row) => ({ ...row, messageId: id })));
    }

    await tx.delete(mailAttachments).where(eq(mailAttachments.messageId, id));

    if (fileIds.length) {
      await tx.insert(mailAttachments).values(
        fileIds.map((fileId, position) => ({
          messageId: id,
          fileId,
          position,
        })),
      );
    }
  });

  return { id };
}

