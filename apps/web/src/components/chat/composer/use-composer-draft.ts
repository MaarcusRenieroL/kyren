"use client";

import { useCallback, useEffect, useRef } from "react";
import { useTrpcClient } from "@kyren/api/react";
import type { Person } from "./composer-types";

export interface UseComposerDraftProps {
  people: Person[];
  draftScope?: { channelId: string; key: string };
  text: string;
  setText: React.Dispatch<React.SetStateAction<string>>;
}

export interface UseComposerDraftReturn {
  chosen: React.RefObject<Map<string, string>>;
  toBody: (value: string) => string;
  fromBody: (body: string) => string;
  clearDraftRemote: () => void;
}

export function useComposerDraft({
  people,
  draftScope,
  text,
  setText,
}: UseComposerDraftProps): UseComposerDraftReturn {
  const trpc = useTrpcClient();
  const chosen = useRef(new Map<string, string>());
  const draftKey = draftScope?.key;
  const draftChannel = draftScope?.channelId;
  const restored = useRef<string | null>(null);
  const loaded = useRef<string | null>(null);
  const lastSaved = useRef("");

  const fromBody = useCallback(
    (body: string) =>
      body.replace(/<@([0-9a-f-]{36})>/g, (whole, id: string) => {
        const person = people.find((entry) => entry.memberId === id);
        if (!person) return whole;
        chosen.current.set(person.name, id);
        return `@${person.name}`;
      }),
    [people],
  );

  const toBody = useCallback((value: string) => {
    let body = value.trim();
    for (const [name, id] of [...chosen.current].sort(
      (a, b) => b[0].length - a[0].length,
    )) {
      body = body.split(`@${name}`).join(`<@${id}>`);
    }
    return body.replace(/@(channel|here)\b/g, "<!$1>");
  }, []);

  useEffect(() => {
    if (!draftKey || !draftScope || restored.current === draftKey) return;
    if (!people.length) return;

    restored.current = draftKey;
    let live = true;

    trpc.chat.draftGet
      .query({ scope: draftKey })
      .then((data) => {
        if (live && data.body)
          setText((current) => current || fromBody(data.body));
      })
      .catch(() => undefined)
      .finally(() => {
        loaded.current = draftKey;
      });

    return () => {
      live = false;
    };
  }, [draftKey, draftScope, people.length, trpc, fromBody, setText]);

  useEffect(() => {
    if (!draftChannel || !draftKey || loaded.current !== draftKey) return;
    const body = toBody(text);
    if (body === lastSaved.current) return;

    const timer = setTimeout(() => {
      lastSaved.current = body;
      void trpc.chat.draftSet
        .mutate({ channelId: draftChannel, scope: draftKey, body })
        .catch(() => undefined);
    }, 900);

    return () => clearTimeout(timer);
  }, [text, draftChannel, draftKey, trpc, toBody]);

  const clearDraftRemote = useCallback(() => {
    if (draftScope) {
      lastSaved.current = "";
      void trpc.chat.draftSet
        .mutate({
          channelId: draftScope.channelId,
          scope: draftScope.key,
          body: "",
        })
        .catch(() => undefined);
    }
  }, [draftScope, trpc]);

  return {
    chosen,
    toBody,
    fromBody,
    clearDraftRemote,
  };
}
