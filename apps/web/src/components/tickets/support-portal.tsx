"use client";

import { Button } from "@kyren/ui/shadcn/button";
import { Label } from "@kyren/ui/shadcn/label";
import { Textarea } from "@kyren/ui/shadcn/textarea";
import { useCallback, useEffect, useState } from "react";
import { apiPath } from "~/src/lib/paths";

type View = {
  ref: string;
  subject: string;
  status: string;
  messages: { body: string; from: "you" | "team"; at: string }[];
};

const dateFormat = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const statusWords: Record<string, string> = {
  open: "Open",
  pending: "Waiting for you",
  resolved: "Resolved",
  spam: "Closed",
};

/** What a requester sees at their private link: the conversation and a reply box. */
export function SupportPortal({ token }: { token: string }) {
  const [view, setView] = useState<View | null>(null);
  const [missing, setMissing] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [loadFailed, setLoadFailed] = useState(false);
  const load = useCallback(async () => {
    setLoadFailed(false);
    try {
      const response = await fetch(apiPath(`/api/portal/${token}`), {
        cache: "no-store",
      });

      if (response.status === 404) {
        setMissing(true);

        return;
      }

      if (!response.ok) throw new Error("Ticket unavailable");
      setView((await response.json()) as View);
    } catch {
      setLoadFailed(true);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const response = await fetch(apiPath(`/api/portal/${token}`), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: text }),
      });

      if (!response.ok) {
        setError("Your message could not be sent. Try again in a moment.");

        return;
      }

      setText("");
      await load();
    } catch {
      setError(
        "Could not confirm delivery. Check the conversation before sending again.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (missing) {
    return (
      <main className="mx-auto max-w-xl p-6">
        <h1 className="text-xl font-semibold">
          We can&apos;t find that request
        </h1>
        <p className="mt-2 text-sm text-ink-2">
          The link may be incomplete. Open it again from the latest email we
          sent you.
        </p>
      </main>
    );
  }

  if (loadFailed) {
    return (
      <main className="mx-auto max-w-xl space-y-3 p-6">
        <p role="alert">The conversation could not be loaded.</p>
        <Button
          variant="custom"
          type="button"
          className="underline"
          onClick={() => void load()}
        >
          Try again
        </Button>
      </main>
    );
  }
  if (!view) {
    return <main className="mx-auto max-w-xl p-6 text-sm">Loading…</main>;
  }

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 p-6">
      <header>
        <p className="text-xs text-ink-3">
          {view.ref} · {statusWords[view.status] ?? view.status}
        </p>
        <h1 className="text-xl font-semibold text-ink">{view.subject}</h1>
      </header>

      <ol className="flex flex-col gap-3">
        {view.messages.map((message, index) => (
          <li
            key={index}
            className={`rounded-xl border p-4 ${
              message.from === "team" ? "border-line bg-sunken" : "border-line"
            }`}
          >
            <p className="mb-1 text-xs text-ink-2">
              {message.from === "team" ? "Support team" : "You"} ·{" "}
              {dateFormat.format(new Date(message.at))}
            </p>
            <p className="text-sm whitespace-pre-wrap text-ink">
              {message.body}
            </p>
          </li>
        ))}
      </ol>

      <form
        onSubmit={(event) => void send(event)}
        className="flex flex-col gap-2"
      >
        <Label className="text-sm font-medium" htmlFor="portal-reply">
          Reply
        </Label>
        <Textarea
          id="portal-reply"
          className="min-h-28 rounded-md border border-line bg-surface p-2 text-sm"
          value={text}
          maxLength={10_000}
          onChange={(event) => setText(event.target.value)}
          required
        />
        {error ? (
          <p role="alert" className="text-sm text-danger-text">
            {error}
          </p>
        ) : null}
        <Button
          variant="custom"
          type="submit"
          disabled={busy || !text.trim()}
          className="self-start rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
        >
          Send reply
        </Button>
      </form>
    </main>
  );
}
