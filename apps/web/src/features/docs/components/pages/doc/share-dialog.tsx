"use client";

import { Label } from "@kyren/ui/shadcn/label";
import { Checkbox } from "@kyren/ui/shadcn/checkbox";
import { useCallback, useEffect, useState } from "react";

import { useTrpcClient } from "@kyren/api/react";
import { toastError, toastSuccess } from "@kyren/ui/index";
import { Button } from "@kyren/ui/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@kyren/ui/shadcn/dialog";
import { Input } from "@kyren/ui/shadcn/input";

import { apiPath } from "~/src/lib/paths";

type Share = { shared: boolean; canManage: boolean; token: string | null };

function copy(text: string, what: string) {
  void navigator.clipboard
    .writeText(text)
    .then(() => toastSuccess("Link copied", what))
    .catch(() => toastError("Error", "Could not copy the link"));
}

/** Who can open this doc: teammates by its address, anyone by a public link. */
export function ShareDialog({
  docId,
  open,
  onOpenChange,
}: {
  docId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const trpc = useTrpcClient();
  const [share, setShare] = useState<Share | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setShare(await trpc.docs.shareLink.query({ id: docId }));
    } catch (error) {
      toastError(error, "Could not load sharing");
    }
  }, [trpc, docId]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const publicUrl = share?.token
    ? `${window.location.origin}${apiPath(`/share/doc/${share.token}`)}`
    : null;

  async function toggle(enabled: boolean) {
    const before = share;

    // The box answers at once; the link appears when the server confirms.
    setShare((current) =>
      current ? { ...current, shared: enabled, token: null } : current,
    );
    setBusy(true);

    try {
      await trpc.docs.setShare.mutate({ id: docId, enabled });
      await load();
      toastSuccess(enabled ? "Public link on" : "Public link off");
    } catch (error) {
      setShare(before);
      toastError(error, "Could not change sharing");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share this doc</DialogTitle>
          <DialogDescription>
            Teammates who can see it open it with its address. A public link
            lets anyone read it, without signing in.
          </DialogDescription>
        </DialogHeader>

        <Button
          variant="outline"
          onClick={() =>
            copy(window.location.href, "Teammates with access can open it.")
          }
        >
          Copy link for teammates
        </Button>

        {share?.canManage ? (
          <Label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={share.shared}
              disabled={busy}
              onCheckedChange={(checked) => void toggle(checked === true)}
            />
            Anyone with the link can read
          </Label>
        ) : share?.shared ? (
          <p className="text-sm text-ink-2">
            This doc has a public link. Someone who can edit it can turn it off.
          </p>
        ) : null}

        {publicUrl ? (
          <div className="flex gap-2">
            <Input readOnly value={publicUrl} aria-label="Public link" />
            <Button
              onClick={() =>
                copy(publicUrl, "Anyone with this link can read the doc.")
              }
            >
              Copy
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
