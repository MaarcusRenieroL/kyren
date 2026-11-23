import { useCallback, useEffect, useRef, useState } from "react";
import type { useTrpcClient } from "@zentro/api/react";
import { everyWhileVisible } from "~/src/lib/poll";
import type { Draft, Person } from "../composer";
import type { MessageView } from "../message-item";
import {
  localView,
  type ChannelData,
  type Local,
  type UseChannelMessagesReturn,
} from "./channel-view-types";

export function useChannelMessages({
  channelId,
  full,
  anchor,
  online,
  trpc,
  sidebar,
  people,
}: {
  channelId: string | undefined;
  full: ChannelData | null;
  anchor: string | null;
  online: boolean;
  trpc: ReturnType<typeof useTrpcClient>;
  sidebar: { refresh: () => void };
  people: Person[];
}): UseChannelMessagesReturn {
  const [messages, setMessages] = useState<MessageView[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [local, setLocal] = useState<Local[]>([]);
  const unfurled = useRef(new Set<string>());

  const refresh = useCallback(
    async (initial = false) => {
      if (!channelId || !full) return;

      try {
        const data = await trpc.chat.messages.query(
          initial && anchor ? { channelId, aroundId: anchor } : { channelId },
        );

        setLoadError(false);
        setMessages((current) => {
          if (!current || initial) {
            setHasMore(data.hasMore);
            return data.messages;
          }

          const byId = new Map(current.map((m) => [m.id, m]));
          for (const m of data.messages) byId.set(m.id, m);

          return [...byId.values()].sort(
            (a, b) =>
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
          );
        });
      } catch {
        setLoadError(true);
      }
    },
    [trpc, channelId, full, anchor],
  );

  useEffect(() => {
    if (full) void refresh(true);
  }, [channelId, full === null]);

  useEffect(() => {
    if (!full) return;
    return everyWhileVisible(refresh, 4000);
  }, [full, refresh]);

  const loadOlder = async (listEl: HTMLDivElement | null) => {
    if (!channelId || !messages?.length) return;
    const first = messages[0]!;
    const previousHeight = listEl?.scrollHeight ?? 0;
    const data = await trpc.chat.messages.query({
      channelId,
      before: first.createdAt,
    });

    setMessages((current) => [...data.messages, ...(current ?? [])]);
    setHasMore(data.hasMore);
    requestAnimationFrame(() => {
      if (listEl) {
        listEl.scrollTop = listEl.scrollHeight - previousHeight;
      }
    });
  };

  const deliver = useCallback(
    async (item: Local) => {
      if (!channelId) return;

      if (!navigator.onLine) {
        setLocal((current) =>
          current.map((e) =>
            e.localId === item.localId ? { ...e, state: "queued" } : e,
          ),
        );
        return;
      }

      setLocal((current) =>
        current.map((e) =>
          e.localId === item.localId ? { ...e, state: "sending" } : e,
        ),
      );

      try {
        await trpc.chat.send.mutate({
          channelId,
          body: item.draft.body,
          fileIds: item.draft.fileIds,
          parentId: item.parentId,
          clientId: item.localId,
        });
        setLocal((current) =>
          current.filter((e) => e.localId !== item.localId),
        );
        await refresh();
        void sidebar.refresh();
      } catch {
        setLocal((current) =>
          current.map((e) =>
            e.localId === item.localId
              ? { ...e, state: navigator.onLine ? "failed" : "queued" }
              : e,
          ),
        );
      }
    },
    [trpc, channelId, refresh, sidebar],
  );

  useEffect(() => {
    if (!online) return;
    for (const item of local.filter((e) => e.state === "queued")) {
      void deliver(item);
    }
  }, [online, deliver, local]);

  useEffect(() => {
    if (!messages) return;
    const pending = messages.filter(
      (m) =>
        !m.deleted &&
        !m.links.length &&
        /https?:\/\/[^\s<]+/.test(m.body) &&
        !unfurled.current.has(m.id) &&
        !m.id.startsWith("local-"),
    );
    if (!pending.length) return;
    for (const m of pending) unfurled.current.add(m.id);

    void Promise.all(
      pending.slice(0, 5).map((m) =>
        trpc.chat.unfurl.mutate({ messageId: m.id }).catch(() => ({
          fetched: 0,
        })),
      ),
    ).then((results) => {
      if (results.some((r) => r.fetched > 0)) void refresh();
    });
  }, [messages, trpc, refresh]);

  const send = async (draft: Draft, onStickBottom: () => void) => {
    const me = people.find((p) => p.isMe);
    if (!channelId || !me) return;

    const localId = crypto.randomUUID();
    const view = localView({
      id: `local-${localId}`,
      channelId,
      clientId: localId,
      body: draft.body,
      author: { memberId: me.memberId, name: me.name },
    });
    const item: Local = { localId, state: "sending", draft, view };

    onStickBottom();
    setLocal((current) => [...current, item]);
    await deliver(item);
  };

  return {
    messages,
    setMessages,
    hasMore,
    loadError,
    local,
    setLocal,
    refresh,
    loadOlder,
    deliver,
    send,
  };
}
