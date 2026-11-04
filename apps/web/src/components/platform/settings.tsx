"use client";

import { useState, type FormEvent } from "react";

import { useTrpcClient } from "@zentro/api/react";
import { InlineAlert } from "@zentro/ui/components/inline-alert";
import { toastError, toastSuccess } from "@zentro/ui/index";
import { Button } from "@zentro/ui/shadcn/button";
import { Input } from "@zentro/ui/shadcn/input";

import { useAsyncData } from "~/src/lib/use-async-data";
import { Failed, Title } from "./common";

export function PlatformSettings() {
  const trpc = useTrpcClient();
  const maintenance = useAsyncData(
    () => trpc.platform.maintenance.get.query(),
    [],
  );
  const rules = useAsyncData(() => trpc.platform.ipRules.list.query(), []);
  const [message, setMessage] = useState<string | null>(null);
  const [cidr, setCidr] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);

  async function act(
    work: () => Promise<unknown>,
    done: string,
    reload: () => void,
  ) {
    setBusy(true);

    try {
      await work();
      toastSuccess(done);
      reload();
    } catch (error) {
      toastError(error, "That did not work.");
    } finally {
      setBusy(false);
    }
  }

  if (maintenance.status === "error")
    return <Failed error={maintenance.error} />;

  const on = maintenance.data?.enabled ?? false;
  const text = message ?? maintenance.data?.message ?? "";

  return (
    <>
      <Title
        title="Maintenance & network"
        description="Put the whole platform into read-only mode, and choose which networks may open this console."
      />

      <section className="flex max-w-xl flex-col gap-3 rounded-xl border border-line p-4">
        <h2 className="text-sm font-semibold">Maintenance mode</h2>
        {on ? (
          <InlineAlert tone="warning" title="Maintenance mode is on">
            Everyone can read but nobody can change anything, except here.
          </InlineAlert>
        ) : (
          <p className="text-sm text-ink-2">
            Off. While on, every change anywhere in Zentro is refused with your
            message; reads keep working.
          </p>
        )}
        <Input
          aria-label="Message to show"
          placeholder="Message to show, e.g. Back at 14:00 UTC"
          value={text}
          onChange={(event) => setMessage(event.target.value)}
        />
        <div>
          <Button
            variant={on ? "default" : "outline"}
            disabled={busy || !maintenance.data}
            onClick={() =>
              void act(
                () =>
                  trpc.platform.maintenance.set.mutate({
                    enabled: !on,
                    message: text,
                  }),
                on ? "Maintenance ended" : "Maintenance started",
                () => {
                  setMessage(null);
                  maintenance.reload();
                },
              )
            }
          >
            {on ? "End maintenance" : "Start maintenance"}
          </Button>
        </div>
      </section>

      <section className="flex max-w-xl flex-col gap-3 rounded-xl border border-line p-4">
        <h2 className="text-sm font-semibold">Console network access</h2>
        <p className="text-sm text-ink-2">
          With no ranges, any network may reach this console (two-factor is
          still required). Add a range to limit it. Your address is{" "}
          <span className="font-mono">
            {rules.data?.yourAddress ?? "unknown"}
          </span>
          ; the first range must include it.
        </p>
        {rules.status === "error" ? <Failed error={rules.error} /> : null}
        <ul className="flex flex-col gap-1 text-sm">
          {rules.data?.rules.map((rule) => (
            <li key={rule.id} className="flex items-center gap-2">
              <span className="font-mono">{rule.cidr}</span>
              <span className="flex-1 truncate text-ink-2">{rule.label}</span>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() =>
                  void act(
                    () => trpc.platform.ipRules.remove.mutate({ id: rule.id }),
                    "Removed",
                    rules.reload,
                  )
                }
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            void act(
              async () => {
                await trpc.platform.ipRules.add.mutate({ cidr, label });
                setCidr("");
                setLabel("");
              },
              "Range added",
              rules.reload,
            );
          }}
        >
          <Input
            aria-label="Address or range"
            placeholder="203.0.113.0/24"
            className="w-48"
            value={cidr}
            onChange={(event) => setCidr(event.target.value)}
          />
          <Input
            aria-label="Label"
            placeholder="Label"
            className="w-40"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
          />
          <Button type="submit" size="sm" disabled={busy || !cidr.trim()}>
            Add range
          </Button>
        </form>
      </section>
    </>
  );
}
