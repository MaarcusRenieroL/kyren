"use client";

import { Label } from "@zentro/ui/shadcn/label";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import { useTrpcClient } from "@zentro/api/react";
import type { AppRouter } from "@zentro/api/server";
import type { inferRouterOutputs } from "@trpc/server";
import { toastError, toastSuccess } from "@zentro/ui/index";
import { Button } from "@zentro/ui/shadcn/button";
import { Input } from "@zentro/ui/shadcn/input";

import { Shell } from "./admin-console";

type Hook = inferRouterOutputs<AppRouter>["webhook"]["list"][number];

export function Webhooks() {
  const trpc = useTrpcClient();
  const [hooks, setHooks] = useState<Hook[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setHooks(await trpc.webhook.list.query());
    } catch {
      setFailed(true);
    }
  }, [trpc]);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(event: FormEvent) {
    event.preventDefault();

    if (!url.trim()) return;

    setBusy(true);

    try {
      const created = await trpc.webhook.create.mutate({ url: url.trim() });

      setSecret(created.secret);
      setUrl("");
      await load();
    } catch (error) {
      toastError(error, "Could not add the webhook.");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(hook: Hook) {
    try {
      await trpc.webhook.setEnabled.mutate({
        id: hook.id,
        enabled: !hook.enabled,
      });
      await load();
    } catch (error) {
      toastError(error, "Could not change the webhook.");
    }
  }

  async function remove(hook: Hook) {
    if (!window.confirm(`Remove ${hook.url}? Queued events are dropped.`)) {
      return;
    }

    try {
      await trpc.webhook.remove.mutate({ id: hook.id });
      toastSuccess("Webhook removed");
      await load();
    } catch (error) {
      toastError(error, "Could not remove the webhook.");
    }
  }

  return (
    <Shell>
      <section
        aria-labelledby="webhooks"
        className="flex max-w-2xl flex-col gap-4"
      >
        <div>
          <h2 id="webhooks" className="text-sm font-semibold text-ink">
            Webhooks
          </h2>
          <p className="text-sm text-ink-2">
            Zentro sends a signed POST to your address whenever something
            happens. It says what happened and to which item, not the content.
            Use an API key to read the details.
          </p>
        </div>

        <form onSubmit={create} className="flex items-end gap-2">
          <Label className="flex flex-1 flex-col items-stretch gap-1.5 text-sm">
            <span className="text-ink-2">Address</span>
            <Input
              type="url"
              placeholder="https://example.com/hooks/zentro"
              value={url}
              maxLength={500}
              onChange={(event) => setUrl(event.target.value)}
            />
          </Label>
          <Button type="submit" disabled={busy || !url.trim()}>
            Add webhook
          </Button>
        </form>

        {secret ? (
          <div
            role="status"
            className="rounded-xl border border-line p-4 text-sm"
          >
            <p className="font-medium text-ink">Copy the signing secret now.</p>
            <p className="text-ink-3">
              It won’t be shown again. Use it to check each request’s signature.
            </p>
            <code
              aria-label="Signing secret"
              className="mt-2 block rounded-lg bg-sunken px-3 py-2 font-mono break-all"
            >
              {secret}
            </code>
          </div>
        ) : null}

        {failed ? (
          <p role="alert" className="text-sm text-danger-text">
            Could not load webhooks.
          </p>
        ) : hooks === null ? null : hooks.length === 0 ? (
          <p className="text-sm text-ink-3">No webhooks yet.</p>
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line">
            {hooks.map((hook) => (
              <li
                key={hook.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
              >
                <span className="min-w-0">
                  <span className="block truncate text-ink">{hook.url}</span>
                  <span className="text-xs text-ink-3">
                    {hook.events.includes("*")
                      ? "All events"
                      : `${hook.events.length} events`}
                    {hook.enabled ? "" : " · paused"}
                  </span>
                </span>
                <span className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void toggle(hook)}
                  >
                    {hook.enabled ? "Pause" : "Resume"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label={`Remove ${hook.url}`}
                    onClick={() => void remove(hook)}
                  >
                    Remove
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Shell>
  );
}
