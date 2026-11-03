"use client";

import { useCallback, useEffect, useState } from "react";

import { useTrpcClient } from "@zentro/api/react";
import { toastError, toastSuccess } from "@zentro/ui/index";
import { Button } from "@zentro/ui/shadcn/button";

/** For people who manage the support email: the address mail providers post to. */
export function SupportInbox() {
  const trpc = useTrpcClient();
  const [state, setState] = useState<{
    enabled: boolean;
    token: string | null;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setState(await trpc.tickets.inbox.query());
    } catch {
      // Optional; the queue works without it.
    }
  }, [trpc]);

  useEffect(() => {
    void load();
  }, [load]);

  async function change(input: { enabled: boolean; rotate?: boolean }) {
    setBusy(true);

    try {
      setState(await trpc.tickets.setInbox.mutate(input));
      toastSuccess(input.rotate ? "Address replaced" : "Saved");
    } catch (error) {
      toastError(error, "Could not change the support email.");
    } finally {
      setBusy(false);
    }
  }

  const address =
    state?.token && typeof window !== "undefined"
      ? `${window.location.origin}/api/inbound/tickets/${state.token}`
      : null;

  return (
    <details className="rounded-xl border border-line px-4 py-3">
      <summary className="cursor-pointer text-sm font-medium text-ink">
        Email to ticket
      </summary>
      <p className="mt-2 text-sm text-ink-2">
        Point your mail provider&apos;s incoming-mail webhook (Resend, Postmark,
        Mailgun or a forwarding rule) at the address below. Each email opens a
        ticket; a reply that keeps [SUP-12] in its subject joins that ticket.
        Anyone who knows the address can open tickets, so keep it private.
      </p>
      {state?.enabled && address ? (
        <p className="mt-2 break-all rounded-md bg-sunken p-2 font-mono text-xs">
          {address}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={busy || !state}
          onClick={() => void change({ enabled: !state?.enabled })}
        >
          {state?.enabled ? "Turn off" : "Turn on"}
        </Button>
        {state?.enabled ? (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => void change({ enabled: true, rotate: true })}
          >
            Replace address
          </Button>
        ) : null}
      </div>
    </details>
  );
}
