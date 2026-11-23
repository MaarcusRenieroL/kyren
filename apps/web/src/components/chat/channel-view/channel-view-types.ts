import { useEffect, useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@zentro/api/server";
import type { Draft } from "../composer";
import type { LocalState, MessageView } from "../message-item";

export type Outputs = inferRouterOutputs<AppRouter>;
export type ChannelData = Extract<Outputs["chat"]["get"], { access: "full" }>;

export type Local = {
  localId: string;
  state: LocalState;
  draft: Draft;
  parentId?: string;
  view: MessageView;
};

export type UseChannelMessagesReturn = {
  messages: MessageView[] | null;
  setMessages: React.Dispatch<React.SetStateAction<MessageView[] | null>>;
  hasMore: boolean;
  loadError: boolean;
  local: Local[];
  setLocal: React.Dispatch<React.SetStateAction<Local[]>>;
  refresh: (initial?: boolean) => Promise<void>;
  loadOlder: (listEl: HTMLDivElement | null) => Promise<void>;
  deliver: (item: Local) => Promise<void>;
  send: (draft: Draft, onStickBottom: () => void) => Promise<void>;
};

export type UseChannelStateReturn = {
  channel: ChannelData | Extract<Outputs["chat"]["get"], { access: "none" }> | null;
  full: ChannelData | null;
  channelId: string | undefined;
  error: "missing" | "failed" | null;
  loadChannel: () => Promise<void>;
  messages: MessageView[] | null;
  hasMore: boolean;
  loadError: boolean;
  local: Local[];
  setLocal: React.Dispatch<React.SetStateAction<Local[]>>;
  typers: string[];
  readers: Array<{ memberId: string; name: string; lastReadAt: Date | string }>;
  readMark: Date | null;
  setReadMark: React.Dispatch<React.SetStateAction<Date | null>>;
  retryIn: number;
  list: React.RefObject<HTMLDivElement | null>;
  stickToBottom: React.MutableRefObject<boolean>;
  refresh: (initial?: boolean) => Promise<void>;
  loadOlder: () => Promise<void>;
  deliver: (item: Local) => Promise<void>;
  send: (draft: Draft) => Promise<void>;
  typed: () => void;
  lastCount: React.MutableRefObject<number>;
  scrolledToUnread: React.MutableRefObject<boolean>;
};

export const FIVE_MINUTES = 5 * 60 * 1000;

/** Tells whether the browser can reach the network right now. */
export function useOnline() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);

    const on = () => setOnline(true);
    const off = () => setOnline(false);

    window.addEventListener("online", on);
    window.addEventListener("offline", off);

    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  return online;
}

/** "30m", "2h", "tomorrow", "monday": when a command should happen. */
export function parseWhen(word: string): Date | null {
  const lower = word.toLowerCase();
  const relative = /^(\d{1,3})(m|min|h|hr)$/.exec(lower);

  if (relative) {
    const amount = Number(relative[1]);

    return new Date(
      Date.now() + amount * (relative[2]!.startsWith("h") ? 3_600_000 : 60_000),
    );
  }

  const date = new Date();

  if (lower === "tomorrow") {
    date.setDate(date.getDate() + 1);
    date.setHours(9, 0, 0, 0);

    return date;
  }

  if (lower === "monday") {
    date.setDate(date.getDate() + ((8 - date.getDay()) % 7 || 7));
    date.setHours(9, 0, 0, 0);

    return date;
  }

  return null;
}

export const slugOf = (title: string) =>
  `${
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "doc"
  }-${Math.random().toString(36).slice(2, 6)}`;

/** A message body as plain text, with mentions written as names. */
export function plainText(body: string, names: Record<string, string>) {
  return body
    .replace(
      /<@([0-9a-f-]{36})>/g,
      (_, id: string) => `@${names[id] ?? "someone"}`,
    )
    .replace(/<!(channel|here)>/g, "@$1");
}

export function localView(
  base: Pick<MessageView, "id" | "channelId" | "clientId" | "body"> & {
    author: { memberId: string; name: string };
  },
): MessageView {
  return {
    ...base,
    parentId: null,
    kind: "message",
    meta: null,
    author: { ...base.author, presence: "active", status: null },
    saved: null,
    poll: null,
    forwarded: null,
    entities: [],
    links: [],
    mine: true,
    createdAt: new Date(),
    editedAt: null,
    deleted: false,
    pinned: false,
    names: {},
    reactions: [],
    attachments: [],
    tasks: [],
    replies: null,
  };
}
