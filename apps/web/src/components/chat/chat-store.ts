"use client";

import { useCallback, useEffect, useState } from "react";

import { useTrpcClient } from "@zentro/api/react";

import type { AppRouter } from "@zentro/api/server";
import type { inferRouterOutputs } from "@trpc/server";
import { everyWhileVisible } from "~/src/lib/poll";

type Outputs = inferRouterOutputs<AppRouter>;
export type SidebarData = Outputs["chat"]["sidebar"];
export type SidebarChannel = SidebarData["channels"][number];

// One copy of the sidebar data per page, shared by the sidebar badge and the
// chat screens, refreshed on a timer and after anything the person does.
let cache: SidebarData | null = null;
const listeners = new Set<(data: SidebarData | null) => void>();
let stopPolling: (() => void) | null = null;
let loader: (() => Promise<void>) | null = null;

function publish(data: SidebarData | null) {
  cache = data;
  listeners.forEach((listener) => listener(data));
}

/** Channels, DMs and unread counts for the signed-in person. */
export function useChatSidebar({ poll = 15_000 }: { poll?: number } = {}): {
  data: SidebarData | null;
  error: boolean;
  refresh: () => Promise<void>;
} {
  const trpc = useTrpcClient();
  const [data, setData] = useState<SidebarData | null>(cache);
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    try {
      publish(await trpc.chat.sidebar.query());
      setError(false);
    } catch {
      setError(true);
    }
  }, [trpc]);

  useEffect(() => {
    listeners.add(setData);
    loader = refresh;

    if (!cache) void refresh();

    if (!stopPolling) {
      stopPolling = everyWhileVisible(() => loader?.(), poll);
    }

    return () => {
      listeners.delete(setData);

      if (!listeners.size && stopPolling) {
        stopPolling();
        stopPolling = null;
      }
    };
  }, [refresh, poll]);

  return { data, error, refresh };
}

/** Total badge for the sidebar item; 0 until loaded or when chat is off. */
export function useChatBadge(enabled: boolean) {
  const trpc = useTrpcClient();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!enabled) return;

    let live = true;
    const load = () =>
      trpc.chat.sidebar
        .query()
        .then((data) => live && setCount(data.totalUnread))
        .catch(() => undefined);

    void load();

    const stop = everyWhileVisible(load, 30_000);

    return () => {
      live = false;
      stop();
    };
  }, [enabled, trpc]);

  return count;
}
