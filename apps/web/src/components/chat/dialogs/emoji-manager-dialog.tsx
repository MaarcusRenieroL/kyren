"use client";

import { Label } from "@kyren/ui/shadcn/label";
import { useRef, useState } from "react";
import { Trash2Icon } from "lucide-react";
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
import { useCustomEmoji } from "../custom-emoji";

/** Upload, list and remove the organization's custom emoji. */
export function EmojiManagerDialog({
  onClose,
  canManage,
}: {
  onClose: () => void;
  canManage: boolean;
}) {
  const trpc = useTrpcClient();
  const custom = useCustomEmoji();
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const add = async () => {
    if (!file) return;

    setSaving(true);

    try {
      const form = new FormData();

      form.append("file", file);

      const response = await fetch(apiPath("/api/files"), {
        method: "POST",
        body: form,
      });
      const data = (await response.json()) as { id?: string; error?: string };

      if (!response.ok || !data.id) {
        throw new Error(data.error ?? "Could not upload the image.");
      }

      await trpc.chat.emojiCreate.mutate({ name, fileId: data.id });
      custom.reload();
      setName("");
      setFile(null);

      if (input.current) input.current.value = "";

      toastSuccess(`:${name}: added`);
    } catch (error) {
      toastError(error, "Could not add the emoji");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (emojiName: string) => {
    try {
      await trpc.chat.emojiDelete.mutate({ name: emojiName });
      custom.reload();
    } catch (error) {
      toastError(error, "Could not remove the emoji");
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="gap-4 sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="text-xl">Custom emoji</DialogTitle>
          <DialogDescription>
            Type :name: in a message or pick one from the emoji menu. Images up
            to 256 KB.
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void add();
          }}
        >
          <Label className="flex min-w-32 flex-1 flex-col items-stretch gap-1 text-sm font-medium">
            Name
            <Input
              value={name}
              maxLength={32}
              onChange={(event) =>
                setName(
                  event.target.value.toLowerCase().replace(/[^a-z0-9_+-]/g, ""),
                )
              }
              placeholder="shipit"
            />
          </Label>
          <Input
            appearance="native"
            ref={input}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            aria-label="Emoji image"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className="max-w-48 text-sm"
          />
          <Button type="submit" disabled={saving || name.length < 2 || !file}>
            {saving ? "Adding…" : "Add"}
          </Button>
        </form>

        {custom.list.length ? (
          <ul className="grid max-h-60 grid-cols-2 gap-1.5 overflow-y-auto">
            {custom.list.map((item) => (
              <li
                key={item.name}
                className="flex items-center gap-2 rounded-md border border-hairline px-2 py-1.5"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.url} alt="" className="size-6" />
                <span className="min-w-0 flex-1 truncate font-mono text-[13px]">
                  :{item.name}:
                </span>
                {canManage ? (
                  <Button
                    variant="custom"
                    type="button"
                    aria-label={`Remove :${item.name}:`}
                    onClick={() => void remove(item.name)}
                    className="rounded-xs text-ink-3 hover:text-danger-text"
                  >
                    <Trash2Icon className="size-4" />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-3">No custom emoji yet.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
