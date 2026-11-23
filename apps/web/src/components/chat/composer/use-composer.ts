"use client";

import {
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { toastError } from "@kyren/ui/index";
import type {
  Draft,
  Option,
  PendingFile,
  Person,
  SlashCommand,
  Trigger,
} from "./composer-types";
import { useComposerDraft } from "./use-composer-draft";
import { useComposerFiles } from "./use-composer-files";
import { useComposerOptions } from "./use-composer-options";

export interface UseComposerProps {
  people: Person[];
  commands?: SlashCommand[];
  draftScope?: { channelId: string; key: string };
  disabled?: boolean;
  canAttach?: boolean;
  autoFocus?: boolean;
  compact?: boolean;
  onSend: (draft: Draft) => Promise<void> | void;
  onSchedule?: (draft: Draft, at: Date) => Promise<void> | void;
  onTyped?: () => void;
}

export interface UseComposerReturn {
  text: string;
  setText: (v: string) => void;
  pending: PendingFile[];
  trigger: Trigger | null;
  setTrigger: (t: Trigger | null) => void;
  options: Option[];
  index: number;
  setIndex: (i: number | ((prev: number) => number)) => void;
  dragging: boolean;
  setDragging: (d: boolean) => void;
  later: boolean;
  setLater: (l: boolean) => void;
  slashQuery?: string;
  empty: boolean;
  reading: boolean;
  areaRef: RefObject<HTMLTextAreaElement | null>;
  customList: Array<{ name: string; url: string }>;
  addFiles: (list: FileList | File[]) => void;
  removeFile: (key: string) => void;
  insert: (before: string, after?: string, fallback?: string) => void;
  pick: (option: Option) => void;
  send: () => Promise<void>;
  sendLater: (at: Date) => Promise<void>;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onPaste: (event: ClipboardEvent) => void;
  onDrop: (event: DragEvent) => void;
  detectTrigger: (value: string, caret: number) => void;
}

export function useComposer(props: UseComposerProps): UseComposerReturn {
  const {
    people,
    commands = [],
    draftScope,
    disabled = false,
    canAttach = true,
    autoFocus = false,
    compact = false,
    onSend,
    onSchedule,
  } = props;

  const [text, setText] = useState("");
  const [later, setLater] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  const {
    pending,
    setPending,
    dragging,
    setDragging,
    reading,
    ready,
    addFiles,
    removeFile,
    onPaste,
    onDrop,
  } = useComposerFiles({ canAttach });

  const { chosen, toBody, clearDraftRemote } = useComposerDraft({
    people,
    draftScope,
    text,
    setText,
  });

  const {
    trigger,
    setTrigger,
    index,
    setIndex,
    options,
    slashQuery,
    detectTrigger,
    customList,
  } = useComposerOptions({ text, people, commands });

  useEffect(() => {
    if (autoFocus) areaRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    const element = areaRef.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, compact ? 140 : 220)}px`;
  }, [text, compact]);

  const empty = !text.trim() && !ready.length;

  const insert = (before: string, after = "", fallback = "") => {
    const element = areaRef.current;
    if (!element) return;

    const { selectionStart: start, selectionEnd: end } = element;
    const selected = text.slice(start, end) || fallback;
    const next =
      text.slice(0, start) + before + selected + after + text.slice(end);

    setText(next);
    requestAnimationFrame(() => {
      element.focus();
      element.setSelectionRange(
        start + before.length,
        start + before.length + selected.length,
      );
    });
  };

  const pick = (option: Option) => {
    if (option.kind === "command") {
      setText(`/${option.command.name} `);
      requestAnimationFrame(() => areaRef.current?.focus());
      return;
    }

    if (!trigger || !areaRef.current) return;
    const caret = areaRef.current.selectionStart;
    let replacement = "";

    if (option.kind === "person") {
      chosen.current?.set(option.person.name, option.person.memberId);
      replacement = `@${option.person.name} `;
    } else if (option.kind === "group") {
      replacement = `@${option.id} `;
    } else if (option.kind === "link") {
      replacement = `${option.result.insert} `;
    } else {
      replacement = option.url ? `:${option.name}: ` : `${option.glyph} `;
    }

    const next = `${text.slice(0, trigger.start)}${replacement}${text.slice(caret)}`;
    setText(next);
    setTrigger(null);
    requestAnimationFrame(() => {
      const position = trigger.start + replacement.length;
      areaRef.current?.focus();
      areaRef.current?.setSelectionRange(position, position);
    });
  };

  const send = async () => {
    if (empty || reading || disabled) return;
    const body = toBody(text);
    const command = /^\/([a-z]+)(?:\s+([\s\S]*))?$/.exec(body);
    const match = command
      ? commands.find((entry) => entry.name === command[1])
      : undefined;

    if (match) {
      setText("");
      setTrigger(null);
      chosen.current?.clear();
      try {
        await match.run((command![2] ?? "").trim());
      } catch (error) {
        toastError(error, `Could not run /${match.name}`);
        setText(text);
      }
      areaRef.current?.focus();
      return;
    }

    const draft = { body, fileIds: ready.map((file) => file.id!) };
    setText("");
    setPending([]);
    setTrigger(null);
    chosen.current?.clear();
    clearDraftRemote();

    await onSend(draft);
    areaRef.current?.focus();
  };

  const sendLater = async (at: Date) => {
    if (empty || reading || disabled || !onSchedule) return;
    const draft = {
      body: toBody(text),
      fileIds: ready.map((file) => file.id!),
    };

    if (!draft.body) {
      toastError("Write a message to schedule.", "Nothing to schedule");
      return;
    }

    setLater(false);
    setText("");
    setPending([]);
    chosen.current?.clear();
    await onSchedule(draft, at);
    areaRef.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (options.length && (trigger || slashQuery !== undefined)) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const delta = event.key === "ArrowDown" ? 1 : -1;
        setIndex((c) => (c + delta + options.length) % options.length);
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        const selected = options[index]!;
        if (!(selected.kind === "command" && event.key === "Enter" && slashQuery === selected.command.name)) {
          event.preventDefault();
          pick(selected);
          return;
        }
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setTrigger(null);
        return;
      }
    }
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void send();
    }
  };

  return {
    text,
    setText,
    pending,
    trigger,
    setTrigger,
    options,
    index,
    setIndex,
    dragging,
    setDragging,
    later,
    setLater,
    slashQuery,
    empty,
    reading,
    areaRef,
    customList,
    addFiles,
    removeFile,
    insert,
    pick,
    send,
    sendLater,
    onKeyDown,
    onPaste,
    onDrop,
    detectTrigger,
  };
}
