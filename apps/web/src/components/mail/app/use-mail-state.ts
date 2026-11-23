"use client";

import { useCallback, useEffect, useState } from "react";
import { useTrpcClient } from "@kyren/api/react";
import { toast, toastError } from "@kyren/ui/index";

import type { ComposeDraft, Person } from "../compose-dialog";
import { everyWhileVisible } from "~/src/lib/poll";
import {
  quote,
  reason,
  stamp,
  type Conversation,
  type Folder,
  type Row,
} from "./mail-types";

export function useMailState() {
  const trpc = useTrpcClient();
  const [folder, setFolder] = useState<Folder>("inbox");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [pages, setPages] = useState(1);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [failed, setFailed] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [unread, setUnread] = useState(0);
  const [people, setPeople] = useState<Person[]>([]);
  const [compose, setCompose] = useState<ComposeDraft | null>(null);

  const fetchPages = useCallback(
    async (count: number) => {
      const items: Row[] = [];
      let next: string | null = null;

      for (let page = 0; page < count; page += 1) {
        const result = await trpc.mail.list.query({
          folder,
          search: search || undefined,
          cursor: next ?? undefined,
        });

        items.push(...result.items);
        next = result.nextCursor;
        if (!next) break;
      }

      return { items, next };
    },
    [trpc, folder, search],
  );

  const load = useCallback(async () => {
    try {
      const [list, count] = await Promise.all([
        fetchPages(pages),
        trpc.mail.unread.query(),
      ]);

      setRows(list.items);
      setCursor(list.next);
      setUnread(count.count);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [trpc, fetchPages, pages]);

  useEffect(() => {
    setPages(1);
  }, [folder, search]);

  async function loadOlder() {
    if (!cursor) return;

    setLoadingOlder(true);
    try {
      const page = await trpc.mail.list.query({
        folder,
        search: search || undefined,
        cursor,
      });

      setRows((current) => [...(current ?? []), ...page.items]);
      setCursor(page.nextCursor);
      setPages((count) => count + 1);
    } catch {
      toastError("Could not load older messages");
    } finally {
      setLoadingOlder(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => void load(), search ? 200 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  useEffect(() => {
    return everyWhileVisible(load, 30_000);
  }, [load]);

  useEffect(() => {
    trpc.mail.people
      .query()
      .then(setPeople)
      .catch(() => undefined);
  }, [trpc]);

  useEffect(() => {
    if (!openId) {
      setConversation(null);
      return;
    }

    let cancelled = false;
    trpc.mail.get
      .query({ id: openId })
      .then((data) => {
        if (cancelled) return;
        setConversation(data);
        void load();
      })
      .catch(() => {
        if (cancelled) return;
        toastError("Could not open the message");
        setOpenId(null);
      });

    return () => {
      cancelled = true;
    };
  }, [trpc, openId, load]);

  async function flag(
    ids: string[],
    change: { read?: boolean; starred?: boolean; trashed?: boolean },
  ) {
    try {
      await trpc.mail.update.mutate({ ids, ...change });
      if (change.trashed !== undefined) setOpenId(null);
      await load();
    } catch (error) {
      toastError("Could not update the message", reason(error));
    }
  }

  async function purge(ids: string[]) {
    if (!window.confirm("Delete for good? This cannot be undone.")) return;

    try {
      await trpc.mail.purge.mutate({ ids });
      setOpenId(null);
      await load();
    } catch (error) {
      toastError("Could not delete the message", reason(error));
    }
  }

  const outgoing = ({ files, ...draft }: ComposeDraft) => ({
    ...draft,
    fileIds: (files ?? []).map((file) => file.id),
  });

  async function send(draft: ComposeDraft) {
    await trpc.mail.send.mutate(outgoing(draft));
    setCompose(null);
    toast.success("Message sent");
    await load();
    if (openId) setOpenId(openId);
  }

  async function keep(draft: ComposeDraft) {
    await trpc.mail.saveDraft.mutate(outgoing(draft));
    setCompose(null);
    toast.success("Draft saved");
    await load();
  }

  async function discard() {
    const id = compose?.id;
    setCompose(null);

    if (id) {
      try {
        await trpc.mail.purge.mutate({ ids: [id] });
        await load();
      } catch {
        // Ignored
      }
    }
  }

  function reply(all: boolean) {
    const last = conversation?.messages.filter((m) => !m.draft).at(-1);
    if (!last) return;

    const me = people.find((person) => person.isMe)?.id;
    const others = last.mine ? last.to.map((p) => p.id) : [last.from.id];
    const to = all
      ? [...new Set([...others, ...last.to.map((p) => p.id)])]
      : others;
    const cc = all ? last.cc.map((p) => p.id) : [];

    setCompose({
      to: to.filter((id) => id !== me || to.length === 1),
      cc: cc.filter((id) => id !== me),
      subject: /^re:/i.test(last.subject)
        ? last.subject
        : `Re: ${last.subject}`,
      body: quote(last.from.name, last.at, last.body),
      replyToId: last.id,
    });
  }

  function forward() {
    const last = conversation?.messages.filter((m) => !m.draft).at(-1);
    if (!last) return;

    setCompose({
      to: [],
      cc: [],
      subject: /^fwd:/i.test(last.subject)
        ? last.subject
        : `Fwd: ${last.subject}`,
      body: `\n\n---------- Forwarded message ----------\nFrom: ${last.from.name}\nDate: ${stamp.format(new Date(last.at))}\n\n${last.body}`,
    });
  }

  async function openRow(row: Row) {
    if (row.draft) {
      try {
        const data = await trpc.mail.get.query({ id: row.id });
        const draft = data.messages.find((message) => message.id === row.id);

        if (draft)
          setCompose({
            id: draft.id,
            to: draft.to.map((p) => p.id),
            cc: draft.cc.map((p) => p.id),
            subject: draft.subject,
            body: draft.body,
            files: draft.attachments,
          });
      } catch (error) {
        toastError("Could not open the draft", reason(error));
      }
      return;
    }

    setOpenId(row.id);
  }

  return {
    folder,
    setFolder,
    search,
    setSearch,
    rows,
    setRows,
    cursor,
    loadingOlder,
    failed,
    load,
    loadOlder,
    openId,
    setOpenId,
    conversation,
    unread,
    people,
    compose,
    setCompose,
    flag,
    purge,
    send,
    keep,
    discard,
    reply,
    forward,
    openRow,
  };
}
