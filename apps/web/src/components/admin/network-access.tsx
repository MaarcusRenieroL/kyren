"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

import { useTrpcClient } from "@zentro/api/react";
import type { AppRouter } from "@zentro/api/server";
import type { inferRouterOutputs } from "@trpc/server";
import { toastError, toastSuccess } from "@zentro/ui/index";
import { Button } from "@zentro/ui/shadcn/button";
import { Input } from "@zentro/ui/shadcn/input";

import { Shell } from "./admin-console";

type State = inferRouterOutputs<AppRouter>["ipAccess"]["get"];

export function NetworkAccess() {
  const trpc = useTrpcClient();
  const [state, setState] = useState<State | null>(null);
  const [failed, setFailed] = useState(false);
  const [cidr, setCidr] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setState(await trpc.ipAccess.get.query());
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

  if (failed) {
    return (
      <Shell>
        <p className="text-sm text-ink-2">
          You need permission to manage network access.
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <section
        aria-labelledby="network"
        className="flex max-w-2xl flex-col gap-4"
      >
        <div>
          <h2 id="network" className="text-sm font-semibold text-ink">
            Network access
          </h2>
          <p className="text-sm text-ink-2">
            Limit this organization to chosen IP addresses or ranges. Your
            current address is{" "}
            <span className="font-mono">{state?.yourIp ?? "unknown"}</span>; it
            must stay allowed or you would be locked out.
          </p>
        </div>

        <ul className="flex flex-col gap-1 text-sm">
          {(state?.entries ?? []).map((entry) => (
            <li key={entry.id} className="flex items-center gap-2">
              <span className="font-mono text-ink">{entry.cidr}</span>
              <span className="flex-1 truncate text-ink-2">{entry.label}</span>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() =>
                  void run(
                    () => trpc.ipAccess.remove.mutate({ id: entry.id }),
                    "Removed",
                  )
                }
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>

        <form
          className="flex flex-wrap items-center gap-2 text-sm"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            void run(async () => {
              await trpc.ipAccess.add.mutate({ cidr, label });
              setCidr("");
              setLabel("");
            }, "Range added");
          }}
        >
          <Input
            aria-label="Address or range"
            placeholder="203.0.113.0/24"
            className="w-48"
            disabled={!state}
            value={cidr}
            onChange={(e) => setCidr(e.target.value)}
          />
          <Input
            aria-label="Label"
            placeholder="Label, e.g. Office"
            className="w-48"
            disabled={!state}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <Button type="submit" size="sm" disabled={busy || !cidr.trim()}>
            Add range
          </Button>
        </form>

        <div className="flex items-center gap-3 rounded-xl border border-line px-4 py-3 text-sm">
          <p className="flex-1 text-ink">
            {state?.enabled
              ? "Only the ranges above can use this organization."
              : "Off: anyone with an account can sign in from anywhere."}
          </p>
          <Button
            size="sm"
            variant={state?.enabled ? "outline" : "default"}
            disabled={busy || !state}
            onClick={() =>
              void run(
                () =>
                  trpc.ipAccess.setEnabled.mutate({ enabled: !state?.enabled }),
                state?.enabled ? "Switched off" : "Switched on",
              )
            }
          >
            {state?.enabled ? "Switch off" : "Switch on"}
          </Button>
        </div>
      </section>
    </Shell>
  );
}
