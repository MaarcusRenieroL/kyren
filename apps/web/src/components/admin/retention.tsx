"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

import { useTrpcClient } from "@zentro/api/react";
import type { AppRouter } from "@zentro/api/server";
import type { inferRouterOutputs } from "@trpc/server";
import { toastError, toastSuccess } from "@zentro/ui/index";
import { Button } from "@zentro/ui/shadcn/button";
import { Input } from "@zentro/ui/shadcn/input";

import { Shell } from "./admin-console";

type State = inferRouterOutputs<AppRouter>["retention"]["get"];

const kinds = [
  {
    type: "chat_messages",
    label: "Chat messages",
    note: "Pinned messages are kept.",
  },
  {
    type: "closed_tickets",
    label: "Closed tickets",
    note: "Resolved and spam tickets only.",
  },
] as const;

export function Retention() {
  const trpc = useTrpcClient();
  const [state, setState] = useState<State | null>(null);
  const [failed, setFailed] = useState(false);
  const [days, setDays] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const next = await trpc.retention.get.query();

      setState(next);
      setDays(
        Object.fromEntries(
          next.policies.map((p) => [p.dataType, String(p.days)]),
        ),
      );
    } catch {
      setFailed(true);
    }
  }, [trpc]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(work: () => Promise<unknown>, done: string) {
    setBusy(true);

    try {
      await work();
      toastSuccess(done);
      await load();
    } catch (error) {
      toastError(error, "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  function savePolicy(type: (typeof kinds)[number]["type"]) {
    return (event: FormEvent) => {
      event.preventDefault();

      const value = (days[type] ?? "").trim();

      void run(
        () =>
          trpc.retention.setPolicy.mutate({
            dataType: type,
            days: value ? Number(value) : null,
          }),
        value ? "Retention saved" : "Kept forever",
      );
    };
  }

  if (failed) {
    return (
      <Shell>
        <p className="text-sm text-ink-2">
          You need permission to manage data retention.
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <section
        aria-labelledby="retention"
        className="flex max-w-2xl flex-col gap-4"
      >
        <div>
          <h2 id="retention" className="text-sm font-semibold text-ink">
            Data retention
          </h2>
          <p className="text-sm text-ink-2">
            Delete old data automatically, once a day. Leave the days empty to
            keep it forever. Minimum 30 days.
          </p>
        </div>
        {kinds.map((kind) => (
          <form
            key={kind.type}
            className="flex flex-wrap items-center gap-2 rounded-xl border border-line px-4 py-3 text-sm"
            onSubmit={savePolicy(kind.type)}
          >
            <div className="min-w-48 flex-1">
              <p className="font-medium text-ink">{kind.label}</p>
              <p className="text-xs text-ink-2">{kind.note}</p>
            </div>
            <Input
              aria-label={`${kind.label}: keep for days`}
              type="number"
              min={30}
              max={3650}
              placeholder="Forever"
              disabled={!state}
              className="w-28"
              value={days[kind.type] ?? ""}
              onChange={(e) =>
                setDays({ ...days, [kind.type]: e.target.value })
              }
            />
            <span className="text-ink-2">days</span>
            <Button
              type="submit"
              size="sm"
              variant="outline"
              disabled={busy || !state}
            >
              Save
            </Button>
          </form>
        ))}

        <div className="rounded-xl border border-line px-4 py-3 text-sm">
          <p className="font-medium text-ink">Legal hold</p>
          <p className="text-xs text-ink-2">
            While on, nothing is deleted by retention and nobody can be erased.
          </p>
          {state?.hold ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-ink">On: {state.hold.reason}</span>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() =>
                  void run(
                    () => trpc.retention.setHold.mutate({ on: false }),
                    "Legal hold lifted",
                  )
                }
              >
                Lift hold
              </Button>
            </div>
          ) : (
            <form
              className="mt-3 flex flex-wrap items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void run(
                  () => trpc.retention.setHold.mutate({ on: true, reason }),
                  "Legal hold placed",
                );
              }}
            >
              <Input
                aria-label="Reason for the legal hold"
                placeholder="Reason, e.g. case number"
                maxLength={500}
                disabled={!state}
                className="w-72"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <Button type="submit" size="sm" disabled={busy || !state}>
                Place hold
              </Button>
            </form>
          )}
        </div>
      </section>
    </Shell>
  );
}
