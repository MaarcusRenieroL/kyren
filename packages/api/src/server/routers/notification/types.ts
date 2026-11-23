import { and, eq } from "@zentro/db/drizzle";
import { notificationPreferences } from "@zentro/db/schema";

export const WINDOW_DAYS = 30;
export const LIMIT = 60;

export const notificationKinds = [
  "mention",
  "assignment",
  "comment",
  "unblock",
] as const;

export const preferenceKinds = [...notificationKinds, "mention_email"] as const;

export type NotificationKind = (typeof notificationKinds)[number];

export type InboxItem = {
  /** Stable per source row, so read marks survive reloads. */
  id: string;
  kind: NotificationKind;
  actor: string;
  verb: string;
  object: string;
  objectIsKey: boolean;
  title: string | null;
  quote: string | null;
  createdAt: Date;
  href: string;
  unread: boolean;
};

export function excerpt(body: string) {
  const text = body
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

  return text.length > 160 ? `${text.slice(0, 157)}…` : text;
}

export async function mutedKindsFor(ctx: {
  db: typeof import("@zentro/db").db;
  user: { id: string };
  activeOrganization: { id: string };
}) {
  const [row] = await ctx.db
    .select({ mutedKinds: notificationPreferences.mutedKinds })
    .from(notificationPreferences)
    .where(
      and(
        eq(notificationPreferences.organizationId, ctx.activeOrganization.id),
        eq(notificationPreferences.userId, ctx.user.id),
      ),
    )
    .limit(1);

  return row?.mutedKinds ?? [];
}
