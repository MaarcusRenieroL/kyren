import { TRPCError } from "@trpc/server";
import {
  and,
  asc,
  desc,
  eq,
  exists,
  gte,
  ilike,
  inArray,
  isNull,
  lt,
  lte,
  ne,
  or,
  sql,
} from "@kyren/db/drizzle";
import {
  chatAttachments,
  chatChannels,
  chatMessages,
  files,
  members,
  users,
} from "@kyren/db/schema";
import { z } from "zod";

import { holdsOwn } from "../../access";
import { currentMemberId, readableChannelIds } from "../../chat";
import { listProcedure } from "../../trpc";
import {
  canReadFile,
  chatProcedure,
  filesProcedure,
  readableChannels,
  uuid,
} from "./access";

export const filesLibraryProcedures = {
  /**
   * Metadata for one file the caller can open. Used by the download route,
   * for library files and chat attachments alike; `canReadFile` decides.
   */
  get: listProcedure("files.view")
    .meta({ permissions: ["files.view", "chat.view"] })
    .input(z.object({ id: uuid }))
    .query(async ({ ctx, input }) => {
      const file = await canReadFile(ctx, input.id);

      if (!file) {
        throw new TRPCError({ code: "NOT_FOUND", message: "File not found." });
      }

      // Where it was shared, counting only conversations the caller reads.
      const readable = await readableChannels(ctx, await currentMemberId(ctx));

      const [usage] = await ctx.db
        .select({
          messages: sql<number>`count(distinct ${chatMessages.id})`.mapWith(
            Number,
          ),
          channelId: sql<string | null>`min(${chatMessages.channelId}::text)`,
        })
        .from(chatAttachments)
        .innerJoin(chatMessages, eq(chatMessages.id, chatAttachments.messageId))
        .where(
          and(
            eq(chatAttachments.fileId, file.id),
            isNull(chatMessages.deletedAt),
            readable.length
              ? inArray(chatMessages.channelId, readable)
              : sql`false`,
          ),
        );
      const [channel] = usage?.channelId
        ? await ctx.db
            .select({ name: chatChannels.name, kind: chatChannels.kind })
            .from(chatChannels)
            .where(eq(chatChannels.id, usage.channelId))
            .limit(1)
        : [];
      const [uploader] = file.uploadedByMemberId
        ? await ctx.db
            .select({ name: users.name })
            .from(members)
            .innerJoin(users, eq(users.id, members.userId))
            .where(eq(members.id, file.uploadedByMemberId))
            .limit(1)
        : [];

      return {
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        size: file.size,
        width: file.width,
        height: file.height,
        createdAt: file.createdAt,
        uploadedBy: uploader?.name ?? null,
        url: `/api/files/${file.id}`,
        sharedIn: channel
          ? { name: channel.name, kind: channel.kind as "channel" | "dm" }
          : null,
        usedIn: { messages: usage?.messages ?? 0 },
      };
    }),

  /** Files shared in a conversation, newest first, for its gallery. */
  list: chatProcedure("chat.view")
    .input(z.object({ channelId: uuid }))
    .query(async ({ ctx, input }) => {
      const memberId = await currentMemberId(ctx);
      const readable = await readableChannelIds(ctx, memberId);

      if (!readable.includes(input.channelId)) return [];

      const rows = await ctx.db
        .select({
          id: files.id,
          name: files.name,
          mimeType: files.mimeType,
          size: files.size,
          width: files.width,
          height: files.height,
          createdAt: files.createdAt,
        })
        .from(chatAttachments)
        .innerJoin(files, eq(files.id, chatAttachments.fileId))
        .innerJoin(chatMessages, eq(chatMessages.id, chatAttachments.messageId))
        .where(
          and(
            eq(chatMessages.channelId, input.channelId),
            isNull(chatMessages.deletedAt),
            isNull(files.deletedAt),
          ),
        )
        .orderBy(desc(files.createdAt))
        .limit(100);

      return rows.map((row) => ({ ...row, url: `/api/files/${row.id}` }));
    }),

  /** The organization's file library, newest first by default. */
  library: filesProcedure("files.view")
    .input(
      z
        .object({
          search: z.string().trim().max(120).optional(),
          kind: z.enum(["all", "image", "document", "other"]).default("all"),
          uploader: z.string().trim().max(120).optional(),
          uploaderId: uuid.optional(),
          minBytes: z.number().int().nonnegative().optional(),
          maxBytes: z.number().int().nonnegative().optional(),
          uploadedFrom: z.iso.datetime().optional(),
          uploadedBefore: z.iso.datetime().optional(),
          sort: z
            .object({
              column: z.enum([
                "name",
                "mimeType",
                "size",
                "uploadedBy",
                "createdAt",
              ]),
              descending: z.boolean(),
            })
            .optional(),
          /**
           * One folder (null: the top of the library); left out, every file.
           * A search always looks in every folder.
           */
          folderId: uuid.nullable().optional(),
          searchWithinFolder: z.boolean().optional(),
          offset: z.number().int().nonnegative().max(2_147_483_647).optional(),
          limit: z.number().int().min(1).max(300).optional(),
        })
        .default({ kind: "all" }),
    )
    .query(async ({ ctx, input }) => {
      const memberId = await currentMemberId(ctx);
      const readable = await readableChannels(ctx, memberId);
      const canDeleteAny = await ctx.permissions.can("files.delete_any");
      const canDeleteOwn = await holdsOwn(ctx, "files.delete_own");
      const escaped = input.search?.replace(/[\\%_]/g, "\\$&");
      const uploader = input.uploader?.replace(/[\\%_]/g, "\\$&");
      const sortColumns = {
        name: sql`lower(${files.name})`,
        mimeType: files.mimeType,
        size: files.size,
        uploadedBy: sql`lower(${users.name})`,
        createdAt: files.createdAt,
      };
      const sort = input.sort ?? { column: "createdAt", descending: true };
      const direction = sort.descending ? desc : asc;

      const rows = await ctx.db
        .select({
          id: files.id,
          name: files.name,
          mimeType: files.mimeType,
          size: files.size,
          width: files.width,
          height: files.height,
          createdAt: files.createdAt,
          uploadedByMemberId: files.uploadedByMemberId,
          folderId: files.folderId,
          uploader: users.name,
        })
        .from(files)
        .leftJoin(members, eq(members.id, files.uploadedByMemberId))
        .leftJoin(users, eq(users.id, members.userId))
        .where(
          and(
            eq(files.organizationId, ctx.activeOrganization.id),
            isNull(files.deletedAt),
            // Mail attachments live with their messages, not in Files.
            ne(files.source, "mail"),
            // Library uploads, the caller's own, and chat files from
            // conversations they read; a private conversation's files, and
            // chat uploads never sent, stay private.
            or(
              eq(files.uploadedByMemberId, memberId),
              eq(files.source, "library"),
              readable.length
                ? exists(
                    ctx.db
                      .select({ one: sql`1` })
                      .from(chatAttachments)
                      .innerJoin(
                        chatMessages,
                        eq(chatMessages.id, chatAttachments.messageId),
                      )
                      .where(
                        and(
                          eq(chatAttachments.fileId, files.id),
                          isNull(chatMessages.deletedAt),
                          inArray(chatMessages.channelId, readable),
                        ),
                      ),
                  )
                : sql`false`,
            ),
            escaped ? ilike(files.name, `%${escaped}%`) : undefined,
            uploader ? ilike(users.name, `%${uploader}%`) : undefined,
            input.uploaderId
              ? eq(files.uploadedByMemberId, input.uploaderId)
              : undefined,
            input.minBytes === undefined
              ? undefined
              : gte(files.size, input.minBytes),
            input.maxBytes === undefined
              ? undefined
              : lte(files.size, input.maxBytes),
            input.uploadedFrom
              ? gte(files.createdAt, new Date(input.uploadedFrom))
              : undefined,
            input.uploadedBefore
              ? lt(files.createdAt, new Date(input.uploadedBefore))
              : undefined,
            (escaped && !input.searchWithinFolder) ||
              input.folderId === undefined
              ? undefined
              : input.folderId === null
                ? isNull(files.folderId)
                : eq(files.folderId, input.folderId),
            input.kind === "image"
              ? ilike(files.mimeType, "image/%")
              : undefined,
            input.kind === "document"
              ? sql`(${files.mimeType} like 'text/%' or ${files.mimeType} like 'application/%')`
              : undefined,
            input.kind === "other"
              ? sql`(${files.mimeType} not like 'image/%' and ${files.mimeType} not like 'text/%' and ${files.mimeType} not like 'application/%')`
              : undefined,
          ),
        )
        .orderBy(
          sql`${direction(sortColumns[sort.column])} nulls last`,
          desc(files.id),
        )
        .limit(input.limit ?? 300)
        .offset(input.offset ?? 0);

      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        mimeType: row.mimeType,
        size: row.size,
        width: row.width,
        height: row.height,
        createdAt: row.createdAt,
        uploadedBy: row.uploader ?? null,
        folderId: row.folderId,
        url: `/api/files/${row.id}`,
        canManage:
          canDeleteAny || (canDeleteOwn && row.uploadedByMemberId === memberId),
      }));
    }),
};
