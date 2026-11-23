import {
  and,
  asc,
  eq,
  inArray,
  isNotNull,
  isNull,
  lt,
  notInArray,
  sql,
} from "@kyren/db/drizzle";
import type { db as Database } from "@kyren/db";
import {
  chatAttachments,
  chatEmojis,
  chatMessages,
  files,
  mailAttachments,
} from "@kyren/db/schema";

import { reportError } from "./error-report";
import { heldOrganizationIds } from "./retention";

/** How long a deleted file's bytes are kept before they are removed. */
export const deletedFileGraceDays = 30;

/**
 * Removes the bytes and records of files deleted more than the grace period
 * ago. Organizations under a legal hold keep everything, and a file a custom
 * emoji or a live message still points at is left alone. Each file's bytes go
 * first and its record only after they are gone, one file at a time, so one
 * stuck object can't hold up the rest and a failure is retried next run.
 */
export async function purgeDeletedFiles(
  db: typeof Database,
  options: {
    now?: Date;
    removeFiles?: (keys: string[]) => Promise<void>;
    batch?: number;
  } = {},
) {
  if (!options.removeFiles) return 0;

  const now = options.now ?? new Date();
  const cutoff = new Date(now.getTime() - deletedFileGraceDays * 86_400_000);
  const held = await heldOrganizationIds(db as never);
  const due = await db
    .select({ id: files.id, key: files.storageKey })
    .from(files)
    .where(
      and(
        isNotNull(files.deletedAt),
        lt(files.deletedAt, cutoff),
        held.length ? notInArray(files.organizationId, held) : undefined,
        sql`not exists (select 1 from ${chatEmojis} where ${chatEmojis.fileId} = ${files.id})`,
        // Deleting a file a live message carries is refused, but a message
        // could attach it between that check and the delete.
        sql`not exists (
          select 1 from ${chatAttachments}
          join ${chatMessages} on ${chatMessages.id} = ${chatAttachments.messageId}
          where ${chatAttachments.fileId} = ${files.id} and ${chatMessages.deletedAt} is null
        )`,
      ),
    )
    .orderBy(asc(files.deletedAt))
    .limit(options.batch ?? 200);

  const removed: string[] = [];

  for (const file of due) {
    try {
      await options.removeFiles([file.key]);
      removed.push(file.id);
    } catch (error) {
      await reportError("purge-deleted-files", error);
    }
  }

  if (removed.length) {
    await db.delete(files).where(inArray(files.id, removed));
  }

  return removed.length;
}

/** How long a mail upload may wait for a message to carry it. */
export const unsentMailFileHours = 24;

/**
 * Deletes mail uploads no message carries: removed from a message before it
 * was sent, left on a discarded draft, or on mail everyone has deleted for
 * good. They go through the normal deleted-file path, so the bytes leave
 * after the grace period and legal holds still apply.
 */
export async function retireUnsentMailFiles(
  db: typeof Database,
  options: { now?: Date } = {},
) {
  const now = options.now ?? new Date();
  const cutoff = new Date(now.getTime() - unsentMailFileHours * 3_600_000);
  const rows = await db
    .update(files)
    .set({ deletedAt: now })
    .where(
      and(
        eq(files.source, "mail"),
        isNull(files.deletedAt),
        lt(files.createdAt, cutoff),
        sql`not exists (select 1 from ${mailAttachments} where ${mailAttachments.fileId} = ${files.id})`,
      ),
    )
    .returning({ id: files.id });

  return rows.length;
}
