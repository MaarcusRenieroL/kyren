import { chatMessages } from "@zentro/db/schema";
import { z } from "zod";

import { type Profile } from "../../chat";
import { permissionProcedure } from "../../trpc";

export const uuid = z.string().uuid();
export const PAGE = 50;

export const chatProcedure = (
  permission: string,
  options: { also?: string[] } = {},
) =>
  permissionProcedure(permission, undefined, { module: "chat", ...options });

export type Row = typeof chatMessages.$inferSelect;

export type ChatAttachment = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  url: string;
};

export type ChatTaskRef = {
  id: string;
  key: string;
  name: string;
  status: string;
  assignee: string | null;
};

/** An internal page a message links to, shown as a card. */
export type ChatEntityRef =
  | {
      type: "doc";
      id: string;
      title: string;
      subtitle: string | null;
      href: string;
    }
  | {
      type: "project";
      id: string;
      title: string;
      subtitle: string | null;
      status: string;
      href: string;
    }
  | {
      type: "file";
      id: string;
      title: string;
      subtitle: string | null;
      mimeType: string;
      href: string;
    }
  | {
      type: "message";
      id: string;
      title: string;
      subtitle: string | null;
      excerpt: string;
      href: string;
    }
  // Exists, but the viewer cannot open it: nothing about it is shown.
  | { type: "missing"; href: string };

export type ChatPollView = {
  id: string;
  question: string;
  multiple: boolean;
  closed: boolean;
  total: number;
  options: Array<{
    label: string;
    votes: number;
    mine: boolean;
    voters: string[];
  }>;
};

export type ChatLinkPreview = {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
};

export type ChatMessageView = {
  id: string;
  channelId: string;
  parentId: string | null;
  clientId: string | null;
  kind: "message" | "poll" | "event" | "huddle";
  meta: Record<string, unknown> | null;
  author: Pick<Profile, "memberId" | "name" | "presence" | "status"> | null;
  /** Saved by the caller, with the reminder if there is one. */
  saved: { remindAt: Date | null } | null;
  poll: ChatPollView | null;
  forwarded: {
    id: string;
    channelId: string;
    channelName: string | null;
    authorName: string;
    excerpt: string;
  } | null;
  entities: ChatEntityRef[];
  links: ChatLinkPreview[];
  mine: boolean;
  body: string;
  createdAt: Date;
  editedAt: Date | null;
  deleted: boolean;
  pinned: boolean;
  /** Display names of the people mentioned, by member id. */
  names: Record<string, string>;
  reactions: Array<{
    emoji: string;
    count: number;
    mine: boolean;
    names: string[];
  }>;
  attachments: ChatAttachment[];
  tasks: ChatTaskRef[];
  replies: { count: number; lastAt: Date | null; people: string[] } | null;
};
