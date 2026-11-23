import { useCallback, useEffect, useRef, useState } from "react";
import type { useTrpcClient } from "@zentro/api/react";
import type { Draft, Person } from "../composer";
import type {
  ChannelData,
  Outputs,
  UseChannelStateReturn,
} from "./channel-view-types";
import { useChannelMessages } from "./use-channel-messages";

export function useChannelState({
  id,
  name,
  anchor,
  online,
  trpc,
  sidebar,
  people,
}: {
  id?: string;
  name?: string;
  anchor: string | null;
  online: boolean;
  trpc: ReturnType<typeof useTrpcClient>;
  sidebar: { refresh: () => void };
  people: Person[];
}): UseChannelStateReturn {
  const [channel, setChannel] = useState<
    ChannelData | Extract<Outputs["chat"]["get"], { access: "none" }> | null
  >(null);
  const [error, setError] = useState<"missing" | "failed" | null>(null);
  const [typers, setTypers] = useState<string[]>([]);
  const [readers, setReaders] = useState<
    Array<{ memberId: string; name: string; lastReadAt: Date | string }>
  >([]);
  const [readMark, setReadMark] = useState<Date | null>(null);
  const [retryIn, setRetryIn] = useState(8);

  const readMarkFor = useRef<string | null>(null);
  const scrolledToUnread = useRef(false);
  const lastTyping = useRef(0);
  const list = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const lastCount = useRef(0);

  const channelId = channel?.id;
  const full = channel?.access === "full" ? channel : null;

  const msgs = useChannelMessages({
    channelId,
    full,
    anchor,
    online,
    trpc,
    sidebar,
    people,
  });

  const loadChannel = useCallback(async () => {
    try {
      setChannel(await trpc.chat.get.query(id ? { id } : { name }));
      setError(null);
    } catch (caught) {
      const code = (caught as { data?: { code?: string } }).data?.code;
      setError(code === "NOT_FOUND" ? "missing" : "failed");
    }
  }, [trpc, id, name]);

  useEffect(() => {
    setChannel(null);
    msgs.setMessages(null);
    msgs.setLocal([]);
    setError(null);
    setReadMark(null);
    setTypers([]);
    setReaders([]);
    readMarkFor.current = null;
    scrolledToUnread.current = false;
    void loadChannel();
  }, [loadChannel]);

  useEffect(() => {
    if (!full || readMarkFor.current === full.id) return;
    readMarkFor.current = full.id;
    setReadMark(
      full.joined && full.lastReadAt ? new Date(full.lastReadAt) : null,
    );
  }, [full]);

  useEffect(() => {
    if (online && !msgs.loadError) return;
    setRetryIn(8);
    const intervalId = setInterval(() => {
      setRetryIn((v) => {
        if (v <= 1) {
          void msgs.refresh();
          return 8;
        }
        return v - 1;
      });
    }, 1000);
    return () => clearInterval(intervalId);
  }, [online, msgs.loadError, msgs.refresh]);

  useEffect(() => {
    if (!channelId || !msgs.messages || !full?.joined) return;
    if (msgs.messages.length === lastCount.current) return;
    lastCount.current = msgs.messages.length;

    if (document.visibilityState === "visible") {
      void trpc.chat.markRead
        .mutate({ channelId })
        .then(() => sidebar.refresh())
        .catch(() => undefined);
    }
  }, [msgs.messages, channelId, full?.joined, trpc, sidebar]);

  useEffect(() => {
    const el = list.current;
    if (!el || !msgs.messages) return;

    if (anchor) {
      document
        .getElementById(`message-${anchor}`)
        ?.scrollIntoView({ block: "center" });
      return;
    }

    const divider = document.getElementById("unread-divider");
    if (divider && !scrolledToUnread.current) {
      scrolledToUnread.current = true;
      stickToBottom.current = false;
      divider.scrollIntoView({ block: "start" });
      return;
    }

    if (stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [msgs.messages, msgs.local, anchor, readMark]);

  useEffect(() => {
    if (!channelId || !full) return;
    let live = true;
    const poll = () => {
      if (document.visibilityState !== "visible") return;
      trpc.chat.typingNow
        .query({ channelId })
        .then((names) => live && setTypers(names))
        .catch(() => undefined);
    };
    const pollId = setInterval(poll, 3000);
    return () => {
      live = false;
      clearInterval(pollId);
    };
  }, [trpc, channelId, full]);

  useEffect(() => {
    if (!channelId || !full) return;
    let live = true;
    const load = () => {
      if (document.visibilityState !== "visible") return;
      trpc.chat.readState
        .query({ channelId })
        .then((rows) => live && setReaders(rows))
        .catch(() => undefined);
    };
    load();
    const intervalId = setInterval(load, 8000);
    return () => {
      live = false;
      clearInterval(intervalId);
    };
  }, [trpc, channelId, full]);

  const typed = () => {
    if (!channelId || Date.now() - lastTyping.current < 3000) return;
    lastTyping.current = Date.now();
    void trpc.chat.typing.mutate({ channelId }).catch(() => undefined);
  };

  return {
    channel,
    full,
    channelId,
    error,
    loadChannel,
    messages: msgs.messages,
    hasMore: msgs.hasMore,
    loadError: msgs.loadError,
    local: msgs.local,
    setLocal: msgs.setLocal,
    typers,
    readers,
    readMark,
    setReadMark,
    retryIn,
    list,
    stickToBottom,
    refresh: msgs.refresh,
    loadOlder: () => msgs.loadOlder(list.current),
    deliver: msgs.deliver,
    send: (draft: Draft) =>
      msgs.send(draft, () => {
        stickToBottom.current = true;
      }),
    typed,
    lastCount,
    scrolledToUnread,
  };
}
