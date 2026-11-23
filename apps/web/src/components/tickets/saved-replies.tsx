"use client";

import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@zentro/ui/shadcn/collapsible";
import { useEffect, useState } from "react";

import { authClient } from "@zentro/auth/client";
import { useTrpcClient } from "@zentro/api/react";
import { toastError, toastSuccess } from "@zentro/ui/index";
import { Button } from "@zentro/ui/shadcn/button";
import { Input } from "@zentro/ui/shadcn/input";
import { NativeSelect } from "@zentro/ui/shadcn/native-select";
import { Textarea } from "@zentro/ui/shadcn/textarea";

import { useAsyncData } from "~/src/lib/use-async-data";

/** Fills `{customer}`, `{agent}` and `{ticket}` in a saved reply. */
export function fillReply(
  body: string,
  values: { customer: string; agent: string; ticket: string },
) {
  return body
    .replaceAll("{customer}", values.customer)
    .replaceAll("{agent}", values.agent)
    .replaceAll("{ticket}", values.ticket);
}

/** A menu of saved replies in the reply box; picking one inserts it. */
export function SavedReplyPicker({
  customer,
  ticket,
  onInsert,
}: {
  customer: string;
  ticket: string;
  onInsert: (text: string) => void;
}) {
  const trpc = useTrpcClient();
  const replies = useAsyncData(() => trpc.cannedReply.list.query(), [trpc]);
  const [agent, setAgent] = useState("");

  useEffect(() => {
    void authClient
      .getSession()
      .then(({ data }) => setAgent(data?.user.name ?? ""))
      .catch(() => undefined);
  }, []);

  if (!replies.data?.length) return null;

  return (
    <NativeSelect
      aria-label="Insert a saved reply"
      value=""
      onChange={(event) => {
        const reply = replies.data?.find((r) => r.id === event.target.value);

        if (reply) onInsert(fillReply(reply.body, { customer, agent, ticket }));
      }}
    >
      <option value="">Insert a saved reply…</option>
      {replies.data.map((reply) => (
        <option key={reply.id} value={reply.id}>
          {reply.title}
        </option>
      ))}
    </NativeSelect>
  );
}

const blank = { id: undefined as string | undefined, title: "", body: "" };

/** For inbox managers: write, edit and remove the saved replies. */
export function SavedRepliesPanel() {
  const trpc = useTrpcClient();
  const [version, setVersion] = useState(0);
  const replies = useAsyncData(
    () => trpc.cannedReply.list.query(),
    [trpc, version],
  );
  const [draft, setDraft] = useState(blank);
  const [busy, setBusy] = useState(false);

  async function run(work: () => Promise<unknown>, done: string) {
    setBusy(true);

    try {
      await work();
      toastSuccess(done);
      setVersion((v) => v + 1);
    } catch (error) {
      toastError(error, "Could not save the reply.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Collapsible
      role="group"
      className="rounded-xl border border-line px-4 py-3"
    >
      <CollapsibleTrigger className="w-full text-left before:mr-2 before:inline-block before:content-['▸'] data-[state=open]:before:rotate-90 cursor-pointer text-sm font-medium text-ink">
        Saved replies
      </CollapsibleTrigger>
      <CollapsibleContent forceMount className="data-[state=closed]:hidden">
        <p className="mt-2 text-sm text-ink-2">
          Answers your team sends often. In the text, {"{customer}"},{" "}
          {"{agent}"} and {"{ticket}"} are filled in when a reply is inserted.
        </p>

        <ul
          aria-label="Saved replies"
          className="mt-3 flex flex-col gap-1 text-sm"
        >
          {(replies.data ?? []).map((reply) => (
            <li key={reply.id} className="flex items-center gap-2">
              <Button
                variant="custom"
                type="button"
                disabled={busy}
                className="min-w-0 flex-1 truncate text-left text-ink hover:underline disabled:opacity-60"
                onClick={() => setDraft(reply)}
              >
                {reply.title}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                aria-label={`Delete saved reply ${reply.title}`}
                onClick={() => {
                  if (
                    !window.confirm(`Delete the saved reply "${reply.title}"?`)
                  ) {
                    return;
                  }

                  void run(async () => {
                    await trpc.cannedReply.remove.mutate({ id: reply.id });

                    if (draft.id === reply.id) setDraft(blank);
                  }, "Saved reply deleted");
                }}
              >
                Delete
              </Button>
            </li>
          ))}
        </ul>

        <form
          className="mt-3 flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void run(async () => {
              await trpc.cannedReply.save.mutate(draft);
              setDraft(blank);
            }, "Saved reply saved");
          }}
        >
          <Input
            aria-label="Saved reply title"
            placeholder="Title, e.g. Refund on its way"
            maxLength={120}
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          />
          <Textarea
            aria-label="Saved reply text"
            rows={4}
            maxLength={10000}
            placeholder="Hi {customer}, …"
            value={draft.body}
            onChange={(e) => setDraft({ ...draft, body: e.target.value })}
          />
          <div className="flex gap-2">
            <Button
              type="submit"
              size="sm"
              disabled={busy || !draft.title.trim() || !draft.body.trim()}
            >
              {draft.id ? "Save changes" : "Add saved reply"}
            </Button>
            {draft.id ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setDraft(blank)}
              >
                New reply
              </Button>
            ) : null}
          </div>
        </form>
      </CollapsibleContent>
    </Collapsible>
  );
}
