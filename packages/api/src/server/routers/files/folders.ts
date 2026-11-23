import { TRPCError } from "@trpc/server";
import { and, eq, isNull, sql } from "@zentro/db/drizzle";
import { fileFolders, files, chatAttachments, chatMessages } from "@zentro/db/schema";
import { z } from "zod";

import { currentMemberId } from "../../chat";
import { filesProcedure, uuid } from "./access";
import {
  folderName,
  folderNameTaken,
  lockedFolder,
  manageableFile,
  manageableFolder,
} from "./helpers";

export const filesFoldersProcedures = {
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
