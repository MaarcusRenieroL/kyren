"use client";

import { useEffect, useMemo, useState } from "react";
import { useTrpcClient } from "@zentro/api/react";
import { builtinShortcodes, useCustomEmoji } from "../custom-emoji";
import type { LinkResult, Option, Person, SlashCommand, Trigger } from "./composer-types";

export interface UseComposerOptionsProps {
  text: string;
  people: Person[];
  commands: SlashCommand[];
}

export interface UseComposerOptionsReturn {
  trigger: Trigger | null;
  setTrigger: (trigger: Trigger | null) => void;
  index: number;
  setIndex: (index: number | ((prev: number) => number)) => void;
  options: Option[];
  slashQuery?: string;
  detectTrigger: (value: string, caret: number) => void;
  customList: Array<{ name: string; url: string }>;
}

export function useComposerOptions({
  text,
  people,
  commands,
}: UseComposerOptionsProps): UseComposerOptionsReturn {
  const trpc = useTrpcClient();
  const custom = useCustomEmoji();
  const [trigger, setTrigger] = useState<Trigger | null>(null);
  const [links, setLinks] = useState<LinkResult[]>([]);
  const [index, setIndex] = useState(0);

  const slashQuery = /^\/([a-z]*)$/.exec(text)?.[1];

  const options = useMemo<Option[]>(() => {
    if (slashQuery !== undefined && commands.length) {
      return commands
        .filter((command) => command.name.startsWith(slashQuery))
        .map((command) => ({ kind: "command" as const, command }));
    }

    if (!trigger) return [];
    const needle = trigger.query.toLowerCase();

    if (trigger.kind === "mention") {
      const matches = people
        .filter((person) => !person.isMe || needle)
        .filter(
          (person) =>
            !needle ||
            person.name.toLowerCase().includes(needle) ||
            person.email.toLowerCase().startsWith(needle),
        )
        .slice(0, 5)
        .map((person) => ({ kind: "person" as const, person }));
      const groups = [
        { kind: "group" as const, id: "channel", note: "Everyone here" },
        { kind: "group" as const, id: "here", note: "People who are active" },
      ].filter((group) => !needle || group.id.startsWith(needle));

      return [...matches, ...groups];
    }

    if (trigger.kind === "link") {
      return links.map((result) => ({ kind: "link" as const, result }));
    }

    const fromCustom = custom.list
      .filter((entry) => entry.name.includes(needle))
      .slice(0, 5)
      .map((entry) => ({
        kind: "emoji" as const,
        name: entry.name,
        url: entry.url,
      }));
    const fromBuiltin = Object.entries(builtinShortcodes)
      .filter(([name]) => name.includes(needle))
      .slice(0, 5)
      .map(([name, glyph]) => ({ kind: "emoji" as const, name, glyph }));

    return [...fromCustom, ...fromBuiltin].slice(0, 7);
  }, [slashQuery, commands, trigger, people, links, custom.list]);

  useEffect(() => {
    if (trigger?.kind !== "link") {
      setLinks([]);
      return;
    }

    let live = true;
    const timer = setTimeout(() => {
      trpc.chat.linkSearch
        .query({ q: trigger.query })
        .then((data) => {
          if (!live) return;
          setLinks([
            ...data.tasks.map((task) => ({
              kind: "task" as const,
              label: task.name,
              hint: task.key,
              insert: task.key,
            })),
            ...data.docs.map((doc) => ({
              kind: "doc" as const,
              label: doc.title,
              hint: "Doc",
              insert: `${window.location.origin}/docs/${doc.slug}`,
            })),
            ...data.projects.map((project) => ({
              kind: "project" as const,
              label: project.name,
              hint: "Project",
              insert: `${window.location.origin}/projects/${project.slug}`,
            })),
          ]);
          setIndex(0);
        })
        .catch(() => undefined);
    }, 150);

    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [trigger, trpc]);

  const detectTrigger = (value: string, caret: number) => {
    const upToCaret = value.slice(0, caret);
    const mention = /(?:^|\s)@([\w.-]{0,30})$/.exec(upToCaret);
    const link = /(?:^|\s)#([\w-]{0,30})$/.exec(upToCaret);
    const shortcode = /(?:^|\s):([a-z0-9_+-]{2,20})$/.exec(upToCaret);

    if (mention) {
      setTrigger({
        kind: "mention",
        query: mention[1] ?? "",
        start: caret - (mention[1]?.length ?? 0) - 1,
      });
    } else if (link) {
      setTrigger({
        kind: "link",
        query: link[1] ?? "",
        start: caret - (link[1]?.length ?? 0) - 1,
      });
    } else if (shortcode) {
      setTrigger({
        kind: "emoji",
        query: shortcode[1] ?? "",
        start: caret - (shortcode[1]?.length ?? 0) - 1,
      });
    } else {
      setTrigger(null);
    }
    setIndex(0);
  };

  return {
    trigger,
    setTrigger,
    index,
    setIndex,
    options,
    slashQuery,
    detectTrigger,
    customList: custom.list,
  };
}
