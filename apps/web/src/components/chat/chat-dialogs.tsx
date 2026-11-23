"use client";

import { Label } from "@kyren/ui/shadcn/label";
import { FieldSet, FieldLegend } from "@kyren/ui/shadcn/field";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { HashIcon, LockIcon } from "lucide-react";

import { useTrpcClient } from "@kyren/api/react";
import { cn } from "@kyren/ui/lib/utils";
import { Button } from "@kyren/ui/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@kyren/ui/shadcn/dialog";
import { Input } from "@kyren/ui/shadcn/input";

import { useChatSidebar } from "./chat-store";
import { usePeople } from "./channel-view";
import { LinkPicker, PeoplePicker } from "./pickers";

export { BrowseChannelsDialog, NewDmDialog } from "./chat-quick-dialogs";

const toName = (value: string) =>
  value
    .toLowerCase()
    .replace(/^#/, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-");

/** Name, who can see it, what it's linked to and who's in it. */
export function NewChannelDialog({
  onClose,
  defaultLink = null,
}: {
  onClose: () => void;
  defaultLink?: { type: "team" | "project"; id: string } | null;
}) {
  const trpc = useTrpcClient();
  const router = useRouter();
  const sidebar = useChatSidebar();
  const people = usePeople();
  const [name, setName] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [link, setLink] = useState(defaultLink);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const clean = toName(name).replace(/^-|-$/g, "");

  const submit = async () => {
    if (clean.length < 2) {
      setError("Use at least 2 letters or numbers.");

      return;
    }

    setSaving(true);
    setError(null);

    try {
      const channel = await trpc.chat.create.mutate({
        name: clean,
        visibility,
        link,
        memberIds,
      });

      await sidebar.refresh();
      onClose();
      router.push(`/chat/${channel.name}`);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not create it.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-h-[90svh] gap-5 overflow-y-auto sm:max-w-[600px]"
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            void submit();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-xl">New channel</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="channel-name" className="text-sm font-medium">
            Name
          </Label>
          <div
            className={cn(
              "flex items-center gap-2 rounded-lg border bg-surface px-3 focus-within:ring-2 focus-within:ring-ring",
              error ? "border-danger" : "border-input",
            )}
          >
            <HashIcon className="size-4 text-ink-3" aria-hidden="true" />
            <Input
              id="channel-name"
              autoFocus
              value={name}
              maxLength={80}
              aria-invalid={Boolean(error) || undefined}
              onChange={(event) => {
                setName(toName(event.target.value));
                setError(null);
              }}
              placeholder="checkout-qa"
              className="h-10 border-0 px-0 shadow-none focus-visible:ring-0"
            />
            <span className="font-mono text-[11px] text-ink-3">
              {name.length}/80
            </span>
          </div>
          {error ? (
            <p role="alert" className="text-[13px] text-danger-text">
              {error}
            </p>
          ) : (
            <p className="text-[13px] text-ink-3">
              Lowercase, numbers and dashes.
            </p>
          )}
        </div>

        <FieldSet className="flex flex-col gap-2">
          <FieldLegend className="mb-1 text-sm font-medium">
            Who can see it
          </FieldLegend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                [
                  "public",
                  "Public",
                  "Anyone at the organization can find and join it.",
                ],
                [
                  "private",
                  "Private",
                  "Only invited people can see it or read messages.",
                ],
              ] as const
            ).map(([value, label, hint]) => (
              <Button
                variant="custom"
                key={value}
                type="button"
                role="radio"
                aria-checked={visibility === value}
                onClick={() => setVisibility(value)}
                className={cn(
                  "flex flex-col gap-1 rounded-lg border p-3 text-left",
                  visibility === value
                    ? "border-ink ring-1 ring-ink"
                    : "border-hairline hover:border-ink-3",
                )}
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  <span
                    className={cn(
                      "size-4 rounded-full border",
                      visibility === value
                        ? "border-[5px] border-ink"
                        : "border-line-strong",
                    )}
                  />
                  {value === "private" ? (
                    <LockIcon className="size-3.5" aria-hidden="true" />
                  ) : (
                    <HashIcon className="size-3.5" aria-hidden="true" />
                  )}
                  {label}
                </span>
                <span className="pl-6 text-[13px] text-ink-2">{hint}</span>
              </Button>
            ))}
          </div>
        </FieldSet>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Link to</span>
          <LinkPicker value={link} onChange={setLink} />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Members</span>
          <PeoplePicker
            people={people}
            selected={memberIds}
            onChange={setMemberIds}
          />
        </div>

        <DialogFooter className="items-center sm:justify-between">
          <span className="text-[13px] text-ink-3">
            You’ll be the channel admin.
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button loading={saving} onClick={() => void submit()}>
              Create channel
              <kbd className="ml-1 rounded-xs bg-on-signal/20 px-1 font-mono text-[10px]">
                ⌘↵
              </kbd>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
