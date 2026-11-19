import { TRPCError } from "@trpc/server";
import {
  and,
  desc,
  eq,
  exists,
  ilike,
  inArray,
  isNull,
  ne,
  or,
  sql,
} from "@zentro/db/drizzle";
import {
  chatAttachments,
  chatChannels,
  chatEmojis,
  chatMessages,
  fileFolders,
  files,
  mailAttachments,
  members,
  users,
} from "@zentro/db/schema";
import { z } from "zod";

import { holdsOwn } from "../access";
import { currentMemberId, readableChannelIds } from "../chat";
import { isUniqueViolation } from "../db-errors";
import { organizationLimits } from "../platform-policy";
import {
  listProcedure,
  permissionProcedure,
  type OrganizationContext,
} from "../trpc";
import { canSeeMessage } from "./mail";

/** Largest file a person can share in chat. */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

/** What one organization may store in total; `STORAGE_LIMIT_BYTES` overrides. */
export function storageLimitBytes() {
  const configured = Number(process.env.STORAGE_LIMIT_BYTES);

  return Number.isFinite(configured) && configured > 0
    ? configured
    : 1024 * 1024 * 1024;
}

async function storageUsed(
  ctx: OrganizationContext,
  handle: Pick<OrganizationContext["db"], "select"> = ctx.db,
) {
  const [row] = await handle
    .select({
      used: sql<number>`coalesce(sum(${files.size}), 0)`.mapWith(Number),
    })
    .from(files)
    .where(
      and(
        eq(files.organizationId, ctx.activeOrganization.id),
        isNull(files.deletedAt),
      ),
    );

  return row?.used ?? 0;
}

/** The storage ceiling for the organization: an operator's override, else the default. */
async function storageCeiling(ctx: OrganizationContext) {
  const { storageMb } = await organizationLimits(
    ctx.db,
    ctx.activeOrganization.id,
  );

  return storageMb ? storageMb * 1024 * 1024 : storageLimitBytes();
}

async function assertRoom(
  ctx: OrganizationContext,
  size: number,
  handle: Pick<OrganizationContext["db"], "select"> = ctx.db,
) {
  if ((await storageUsed(ctx, handle)) + size > (await storageCeiling(ctx))) {
    throw new TRPCError({
      code: "PAYLOAD_TOO_LARGE",
      message:
        "Your organization is out of file storage. Delete some files to make room.",
    });
  }
}

const uuid = z.string().uuid();

const filesProcedure = (permission: string, audit?: string[]) =>
  permissionProcedure(permission, undefined, { module: "files", audit });

const chatProcedure = (permission: string) =>
  permissionProcedure(permission, undefined, { module: "chat" });

const mailProcedure = (permission: string) =>
  permissionProcedure(permission, undefined, { module: "mail" });

/** Conversations whose files the caller may see; none when Chat is off. */
async function readableChannels(ctx: OrganizationContext, memberId: string) {
  const enabled = await ctx.enabledModules();

  return enabled.has("chat") ? readableChannelIds(ctx, memberId) : [];
}

/**
 * Whether the caller may open a file:
 * - their own upload;
 * - a file uploaded to the library, when they can view Files;
 * - a file attached to a live message in a conversation they can read;
 * - a custom emoji, which everyone using Chat sees.
 */
export async function canReadFile(ctx: OrganizationContext, fileId: string) {
  const memberId = await currentMemberId(ctx);
  const [file] = await ctx.db
    .select()
    .from(files)
    .where(
      and(
        eq(files.id, fileId),
        eq(files.organizationId, ctx.activeOrganization.id),
        isNull(files.deletedAt),
      ),
    )
    .limit(1);

  if (!file) return null;
  if (file.uploadedByMemberId === memberId) return file;

  const enabled = await ctx.enabledModules();

  // A mail attachment opens for whoever can read a message carrying it.
  if (file.source === "mail") {
    if (!enabled.has("mail") || !(await ctx.permissions.can("mail.view"))) {
      return null;
    }

    const carriers = await ctx.db
      .select({ messageId: mailAttachments.messageId })
      .from(mailAttachments)
      .where(eq(mailAttachments.fileId, fileId));

    for (const { messageId } of carriers) {
      if (await canSeeMessage(ctx, memberId, messageId)) return file;
    }

    return null;
  }

  if (enabled.has("chat") && (await ctx.permissions.can("chat.view"))) {
    const [emoji] = await ctx.db
      .select({ id: chatEmojis.id })
      .from(chatEmojis)
      .where(
        and(
          eq(chatEmojis.fileId, fileId),
          eq(chatEmojis.organizationId, ctx.activeOrganization.id),
        ),
      )
      .limit(1);

    if (emoji) return file;
  }

  const uses = await ctx.db
    .select({
      channelId: chatMessages.channelId,
      deletedAt: chatMessages.deletedAt,
    })
    .from(chatAttachments)
    .innerJoin(chatMessages, eq(chatMessages.id, chatAttachments.messageId))
    .where(eq(chatAttachments.fileId, fileId));

  if (
    file.source === "library" &&
    enabled.has("files") &&
    (await ctx.permissions.can("files.view"))
  ) {
    return file;
  }

  // A chat upload that was never sent stays with its uploader.
  if (!uses.length) return null;

  const readable = new Set(await readableChannels(ctx, memberId));

  return uses.some((use) => !use.deletedAt && readable.has(use.channelId))
    ? file
    : null;
}

async function folderOf(ctx: OrganizationContext, id: string) {
  const [folder] = await ctx.db
    .select()
    .from(fileFolders)
    .where(
      and(
        eq(fileFolders.id, id),
        eq(fileFolders.organizationId, ctx.activeOrganization.id),
      ),
    )
    .limit(1);

  if (!folder) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Folder not found." });
  }

  return folder;
}

/** A folder its creator, or someone who may manage any file, may change. */
async function manageableFolder(ctx: OrganizationContext, id: string) {
  const folder = await folderOf(ctx, id);

  if (
    folder.createdByMemberId !== (await currentMemberId(ctx)) &&
    !(await ctx.permissions.can("files.delete_any"))
  ) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only the person who made this folder can change it.",
    });
  }

  return folder;
}

/** A taken folder name reads as a plain message, not a server error. */
function folderNameTaken(error: unknown): never {
  if (isUniqueViolation(error)) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "There is already a folder with that name.",
    });
  }

  throw error;
}

const folderName = z.string().trim().min(1, "Name the folder.").max(80);

async function manageableFile(ctx: OrganizationContext, id: string) {
  const memberId = await currentMemberId(ctx);
  const [file] = await ctx.db
    .select()
    .from(files)
    .where(
      and(
        eq(files.id, id),
        eq(files.organizationId, ctx.activeOrganization.id),
        isNull(files.deletedAt),
      ),
    )
    .limit(1);

  if (!file) {
    throw new TRPCError({ code: "NOT_FOUND", message: "File not found." });
  }

  // A mail attachment belongs to the messages carrying it: renaming,
  // moving or deleting it would change mail other people already have.
  if (file.source === "mail") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Mail attachments can't be changed here.",
    });
  }

  if (
    file.uploadedByMemberId !== memberId &&
    !(await ctx.permissions.can("files.delete_any"))
  ) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You can only change files you uploaded.",
    });
  }

  return file;
}

const registerInput = z.object({
  name: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(120),
  size: z.number().int().positive().max(MAX_FILE_BYTES),
  width: z.number().int().positive().max(100_000).nullable().default(null),
  height: z.number().int().positive().max(100_000).nullable().default(null),
  storageKey: z.string().min(1).max(300),
  /** A library folder to file it in straight away. */
  folderId: uuid.nullable().default(null),
});

/** The folder, locked against deletion until the transaction ends. */
async function lockedFolder(
  tx: Pick<OrganizationContext["db"], "select">,
  organizationId: string,
  id: string,
) {
  const [folder] = await tx
    .select({ id: fileFolders.id, name: fileFolders.name })
    .from(fileFolders)
    .where(
      and(
        eq(fileFolders.id, id),
        eq(fileFolders.organizationId, organizationId),
      ),
    )
    .limit(1)
    .for("share");

  if (!folder) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Folder not found." });
  }

  return folder;
}

async function registerFile(
  ctx: OrganizationContext,
  input: z.infer<typeof registerInput>,
  source: "library" | "chat" | "mail",
) {
  const memberId = await currentMemberId(ctx);
  // Keys are generated by the server under the organization's folder.
  const prefix = `${ctx.activeOrganization.id}/`;

  if (!input.storageKey.startsWith(prefix) || input.storageKey.includes("..")) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Bad file key." });
  }

  try {
    // Checking for room and recording the file happen under one lock per
    // organization, so two uploads at once can't both fit into the last space.
    return await ctx.db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`files:${ctx.activeOrganization.id}`}, 0))`,
      );
      await assertRoom(ctx, input.size, tx);

      // Only library uploads go in folders; a chat upload stays with chat.
      const folder =
        source === "library" && input.folderId
          ? await lockedFolder(tx, ctx.activeOrganization.id, input.folderId)
          : null;

      const [row] = await tx
        .insert(files)
        .values({
          organizationId: ctx.activeOrganization.id,
          uploadedByMemberId: memberId,
          source,
          ...input,
          folderId: folder?.id ?? null,
        })
        .returning({ id: files.id });

      return { id: row!.id };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "That file has already been registered.",
      });
    }

    throw error;
  }
}

async function checkSize(ctx: OrganizationContext, size: number) {
  if (size > MAX_FILE_BYTES) {
    throw new TRPCError({
      code: "PAYLOAD_TOO_LARGE",
      message: "Files can be up to 25 MB.",
    });
  }

  await assertRoom(ctx, size);

  return { ok: true, maxBytes: MAX_FILE_BYTES };
}

export const filesRouterProcedures = {
  /** Checked before the bytes are written. */
  authorizeUpload: chatProcedure("chat.files.upload")
    .input(z.object({ size: z.number().int().positive() }))
    .query(({ ctx, input }) => checkSize(ctx, input.size)),

  /** How much of the organization's storage is in use. */
  usage: filesProcedure("files.view").query(async ({ ctx }) => ({
    used: await storageUsed(ctx),
    limit: await storageCeiling(ctx),
  })),

  /** Records a file once its bytes are stored. */
  register: chatProcedure("chat.files.upload")
    .input(registerInput)
    .mutation(({ ctx, input }) => registerFile(ctx, input, "chat")),

  /** Upload check for the Files library. */
  libraryAuthorize: filesProcedure("files.upload")
    .input(z.object({ size: z.number().int().positive() }))
    .query(({ ctx, input }) => checkSize(ctx, input.size)),

  /** Upload check for a mail attachment: it needs the right to send mail. */
  mailAuthorize: mailProcedure("mail.send")
    .input(z.object({ size: z.number().int().positive() }))
    .query(({ ctx, input }) => checkSize(ctx, input.size)),

  /**
   * Records a mail attachment. It stays out of the Files library: only its
   * uploader, and the people the message reaches, can open it.
   */
  mailRegister: mailProcedure("mail.send")
    .input(registerInput)
    .mutation(({ ctx, input }) => registerFile(ctx, input, "mail")),

  /** Records a file uploaded to the Files library. */
  libraryRegister: filesProcedure("files.upload")
    .input(registerInput)
    .mutation(({ ctx, input }) => registerFile(ctx, input, "library")),

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

  /** The organization's file library, newest first. */
  library: filesProcedure("files.view")
    .input(
      z
        .object({
          search: z.string().trim().max(120).optional(),
          kind: z.enum(["all", "image", "document", "other"]).default("all"),
          /**
           * One folder (null: the top of the library); left out, every file.
           * A search always looks in every folder.
           */
          folderId: uuid.nullable().optional(),
        })
        .default({ kind: "all" }),
    )
    .query(async ({ ctx, input }) => {
      const memberId = await currentMemberId(ctx);
      const readable = await readableChannels(ctx, memberId);
      const canDeleteAny = await ctx.permissions.can("files.delete_any");
      const canDeleteOwn = await holdsOwn(ctx, "files.delete_own");
      const escaped = input.search?.replace(/[\\%_]/g, "\\$&");

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
            escaped || input.folderId === undefined
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
        .orderBy(desc(files.createdAt))
        .limit(300);

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

  /** The library's folders, by name, with how many live files each holds. */
  folders: filesProcedure("files.view").query(async ({ ctx }) => {
    const memberId = await currentMemberId(ctx);
    const canManageAny = await ctx.permissions.can("files.delete_any");
    const rows = await ctx.db
      .select({
        id: fileFolders.id,
        name: fileFolders.name,
        createdByMemberId: fileFolders.createdByMemberId,
        files: sql<number>`count(${files.id})`.mapWith(Number),
      })
      .from(fileFolders)
      // Counts library uploads only: a private chat file someone filed here
      // stays private, and so does its existence.
      .leftJoin(
        files,
        and(
          eq(files.folderId, fileFolders.id),
          isNull(files.deletedAt),
          eq(files.source, "library"),
        ),
      )
      .where(eq(fileFolders.organizationId, ctx.activeOrganization.id))
      .groupBy(fileFolders.id)
      .orderBy(sql`lower(${fileFolders.name})`)
      .limit(500);

    return rows.map(({ createdByMemberId, ...row }) => ({
      ...row,
      canManage: canManageAny || createdByMemberId === memberId,
    }));
  }),

  createFolder: filesProcedure("files.upload", ["files.folder_created"])
    .input(z.object({ name: folderName }))
    .mutation(async ({ ctx, input }) => {
      const memberId = await currentMemberId(ctx);

      return ctx.db
        .transaction(async (tx) => {
          const [folder] = await tx
            .insert(fileFolders)
            .values({
              organizationId: ctx.activeOrganization.id,
              name: input.name,
              createdByMemberId: memberId,
            })
            .returning({ id: fileFolders.id });

          await ctx.audit.record(tx, {
            action: "files.folder_created",
            target: { id: folder!.id, label: input.name },
          });

          return { id: folder!.id };
        })
        .catch(folderNameTaken);
    }),

  renameFolder: filesProcedure("files.upload", ["files.folder_renamed"])
    .input(z.object({ id: uuid, name: folderName }))
    .mutation(async ({ ctx, input }) => {
      const folder = await manageableFolder(ctx, input.id);

      await ctx.db
        .transaction(async (tx) => {
          await tx
            .update(fileFolders)
            .set({ name: input.name })
            .where(eq(fileFolders.id, folder.id));
          await ctx.audit.record(tx, {
            action: "files.folder_renamed",
            target: { id: folder.id, label: input.name },
            metadata: { from: folder.name },
          });
        })
        .catch(folderNameTaken);

      return { id: folder.id };
    }),

  /** Deletes a folder; its files move to the top of the library, not away. */
  deleteFolder: filesProcedure("files.upload", ["files.folder_deleted"])
    .input(z.object({ id: uuid }))
    .mutation(async ({ ctx, input }) => {
      const folder = await manageableFolder(ctx, input.id);

      await ctx.db.transaction(async (tx) => {
        // The files' foreign key moves them to the top (ON DELETE SET NULL).
        await tx.delete(fileFolders).where(eq(fileFolders.id, folder.id));
        await ctx.audit.record(tx, {
          action: "files.folder_deleted",
          target: { id: folder.id, label: folder.name },
        });
      });

      return { id: folder.id };
    }),

  /** Moves a file the caller may manage into a folder, or out (null). */
  moveFile: filesProcedure("files.delete_own", ["files.file_moved"])
    .input(z.object({ id: uuid, folderId: uuid.nullable() }))
    .mutation(async ({ ctx, input }) => {
      const file = await manageableFile(ctx, input.id);

      await ctx.db.transaction(async (tx) => {
        // Checked and held inside the move, so a folder deleted at the same
        // moment is a plain "not found", not a broken reference.
        const folder = input.folderId
          ? await lockedFolder(tx, ctx.activeOrganization.id, input.folderId)
          : null;

        await tx
          .update(files)
          .set({ folderId: folder?.id ?? null })
          .where(eq(files.id, file.id));
        await ctx.audit.record(tx, {
          action: "files.file_moved",
          target: { id: file.id, label: file.name },
          metadata: { folder: folder?.name ?? null },
        });
      });

      return { id: file.id };
    }),

  /** Renames a file the caller owns or may manage. */
  rename: filesProcedure("files.delete_own", ["files.file_renamed"])
    .input(z.object({ id: uuid, name: z.string().trim().min(1).max(255) }))
    .mutation(async ({ ctx, input }) => {
      const file = await manageableFile(ctx, input.id);

      await ctx.db.transaction(async (tx) => {
        await tx
          .update(files)
          .set({ name: input.name })
          .where(eq(files.id, file.id));
        await ctx.audit.record(tx, {
          action: "files.file_renamed",
          target: { id: file.id, label: input.name },
        });
      });

      return { id: file.id };
    }),

  /**
   * Removes a file. One that live messages still carry is refused: deleting
   * it would leave those messages pointing at nothing.
   */
  remove: filesProcedure("files.delete_own", ["files.file_deleted"])
    .input(z.object({ id: uuid }))
    .mutation(async ({ ctx, input }) => {
      const file = await manageableFile(ctx, input.id);
      const [used] = await ctx.db
        .select({ n: sql<number>`count(*)`.mapWith(Number) })
        .from(chatAttachments)
        .innerJoin(chatMessages, eq(chatMessages.id, chatAttachments.messageId))
        .where(
          and(
            eq(chatAttachments.fileId, file.id),
            isNull(chatMessages.deletedAt),
          ),
        );

      if (used?.n) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `This file is shared in ${used.n} ${used.n === 1 ? "message" : "messages"}. Delete ${used.n === 1 ? "it" : "them"} in Chat first.`,
        });
      }

      await ctx.db.transaction(async (tx) => {
        await tx
          .update(files)
          .set({ deletedAt: new Date() })
          .where(eq(files.id, file.id));
        await ctx.audit.record(tx, {
          action: "files.file_deleted",
          target: { id: file.id, label: file.name },
        });
      });

      return { id: file.id };
    }),
};
