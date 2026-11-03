"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

import { useTrpcClient } from "@zentro/api/react";
import type { AppRouter } from "@zentro/api/server";
import type { inferRouterOutputs } from "@trpc/server";
import { toastError, toastSuccess } from "@zentro/ui/index";
import { Button } from "@zentro/ui/shadcn/button";
import { Input } from "@zentro/ui/shadcn/input";

import { Shell } from "./admin-console";

type Key = inferRouterOutputs<AppRouter>["apiKey"]["list"][number];

const when = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function ApiKeys() {
  const trpc = useTrpcClient();
  const [keys, setKeys] = useState<Key[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setKeys(await trpc.apiKey.list.query());
    } catch {
      setFailed(true);
    }
  }, [trpc]);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(event: FormEvent) {
    event.preventDefault();

    if (!name.trim()) return;

    setBusy(true);

    try {
      const created = await trpc.apiKey.create.mutate({ name: name.trim() });

      setFresh(created.key);
      setName("");
      await load();
    } catch (error) {
      toastError(error, "Could not create the key.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(key: Key) {
    if (
      !window.confirm(`Revoke "${key.name}"? Anything using it stops working.`)
    ) {
      return;
    }

    try {
      await trpc.apiKey.revoke.mutate({ id: key.id });
      toastSuccess("Key revoked");
      await load();
    } catch (error) {
      toastError(error, "Could not revoke the key.");
    }
  }

  return (
    <Shell>
      <section
        aria-labelledby="api-keys"
        className="flex max-w-2xl flex-col gap-4"
      >
        <div>
          <h2 id="api-keys" className="text-sm font-semibold text-ink">
            API keys
          </h2>
          <p className="text-sm text-ink-2">
            Keys read tasks and projects over <code>/api/v1</code>. A key sees
            only what you can see, and stops working if you leave.
          </p>
        </div>

        <form onSubmit={create} className="flex items-end gap-2">
          <label className="flex flex-1 flex-col gap-1.5 text-sm">
            <span className="text-ink-2">Key name</span>
            <Input
              value={name}
              maxLength={80}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <Button type="submit" disabled={busy || !name.trim()}>
            Create key
          </Button>
        </form>

        {fresh ? (
          <div
            role="status"
            className="rounded-xl border border-line p-4 text-sm"
          >
            <p className="font-medium text-ink">Copy your key now.</p>
            <p className="text-ink-3">It won’t be shown again.</p>
            <code
              aria-label="New API key"
              className="mt-2 block rounded-lg bg-sunken px-3 py-2 font-mono break-all"
            >
              {fresh}
            </code>
          </div>
        ) : null}

        {failed ? (
          <p role="alert" className="text-sm text-danger-text">
            Could not load keys.
          </p>
        ) : keys === null ? null : keys.length === 0 ? (
          <p className="text-sm text-ink-3">No keys yet.</p>
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line">
            {keys.map((key) => (
              <li
                key={key.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
              >
                <span className="min-w-0">
                  <span className="block truncate text-ink">{key.name}</span>
                  <span className="text-xs text-ink-3">
                    <code>{key.prefix}…</code> · by {key.createdBy} ·{" "}
                    {key.lastUsedAt
                      ? `last used ${when.format(new Date(key.lastUsedAt))}`
                      : "never used"}
                  </span>
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={`Revoke ${key.name}`}
                  onClick={() => void revoke(key)}
                >
                  Revoke
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Shell>
  );
}
