"use client";

import { useState, type FormEvent } from "react";

import { useTrpcClient } from "@zentro/api/react";
import { toastError, toastSuccess } from "@zentro/ui/index";
import { Button } from "@zentro/ui/shadcn/button";
import { Input } from "@zentro/ui/shadcn/input";

import { useAsyncData } from "~/src/lib/use-async-data";
import { Failed, Title, formatDate } from "./common";

export function PlatformAnnouncements() {
  const trpc = useTrpcClient();
  const list = useAsyncData(() => trpc.platform.announcements.list.query(), []);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [severity, setSeverity] = useState<"info" | "warning" | "critical">(
    "info",
  );
  const [busy, setBusy] = useState(false);

  async function act(work: () => Promise<unknown>, done: string) {
    setBusy(true);

    try {
      await work();
      toastSuccess(done);
      list.reload();
    } catch (error) {
      toastError(error, "That did not work.");
    } finally {
      setBusy(false);
    }
  }

  const now = Date.now();

  return (
    <>
      <Title
        title="Announcements"
        description="A notice every signed-in user sees as a banner until it ends or you withdraw it."
      />
      <form
        className="flex max-w-xl flex-col gap-2"
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          void act(async () => {
            await trpc.platform.announcements.create.mutate({
              title,
              body,
              severity,
            });
            setTitle("");
            setBody("");
          }, "Published");
        }}
      >
        <Input
          aria-label="Title"
          placeholder="Title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <Input
          aria-label="Details"
          placeholder="Details (optional)"
          value={body}
          onChange={(event) => setBody(event.target.value)}
        />
        <div className="flex items-center gap-2">
          {(["info", "warning", "critical"] as const).map((level) => (
            <Button
              key={level}
              type="button"
              size="sm"
              variant={severity === level ? "default" : "outline"}
              onClick={() => setSeverity(level)}
            >
              {level}
            </Button>
          ))}
          <Button type="submit" disabled={busy || !title.trim()}>
            Publish now
          </Button>
        </div>
      </form>

      {list.status === "error" ? <Failed error={list.error} /> : null}
      <ul className="flex flex-col gap-2 text-sm">
        {list.data?.map((item) => {
          const live =
            !item.withdrawnAt &&
            new Date(item.startsAt).getTime() <= now &&
            (!item.endsAt || new Date(item.endsAt).getTime() > now);

          return (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-xl border border-line px-4 py-3"
            >
              <div className="flex-1">
                <div className="font-medium">
                  {item.title}{" "}
                  <span className="text-xs text-ink-2">({item.severity})</span>
                </div>
                <div className="text-ink-2">
                  {item.body || "No details"} · {formatDate(item.startsAt)}
                  {item.withdrawnAt ? " · withdrawn" : live ? " · live" : ""}
                </div>
              </div>
              {live ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    void act(
                      () =>
                        trpc.platform.announcements.withdraw.mutate({
                          id: item.id,
                        }),
                      "Withdrawn",
                    )
                  }
                >
                  Withdraw
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </>
  );
}
