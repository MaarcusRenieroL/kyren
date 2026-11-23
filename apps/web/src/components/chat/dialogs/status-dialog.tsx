"use client";

import { Label } from "@kyren/ui/shadcn/label";
import { useEffect, useState } from "react";
import { BellOffIcon } from "lucide-react";
import { useTrpcClient } from "@kyren/api/react";
import { cn } from "@kyren/ui/lib/utils";
import { toastError, toastSuccess } from "@kyren/ui/index";
import { Button } from "@kyren/ui/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@kyren/ui/shadcn/dialog";
import { Input } from "@kyren/ui/shadcn/input";
import { NativeSelect } from "@kyren/ui/shadcn/native-select";

import { useChatSidebar } from "../chat-store";

const dndChoices: Array<[string, number]> = [
  ["30 minutes", 30],
  ["1 hour", 60],
  ["Until tomorrow 9:00", -1],
  ["1 week", 60 * 24 * 7],
];

const clearChoices: Array<[string, number | null]> = [
  ["Don’t clear", null],
  ["In 30 minutes", 30],
  ["In 1 hour", 60],
  ["Today", -1],
  ["In 1 week", 60 * 24 * 7],
];

/** Minutes from now until tomorrow at 9:00 (or end of today when `today`). */
function untilTomorrow(today = false) {
  const date = new Date();

  if (today) {
    date.setHours(23, 59, 0, 0);
  } else {
    date.setDate(date.getDate() + 1);
    date.setHours(9, 0, 0, 0);
  }

  return Math.max(1, Math.round((date.getTime() - Date.now()) / 60_000));
}

const statusPresets: Array<[string, string]> = [
  ["📅", "In a meeting"],
  ["🚌", "Commuting"],
  ["🤒", "Out sick"],
  ["🌴", "On leave"],
  ["🎯", "Focusing"],
];

/** Custom status and do not disturb. */
export function StatusDialog({ onClose }: { onClose: () => void }) {
  const trpc = useTrpcClient();
  const sidebar = useChatSidebar();
  const [emoji, setEmoji] = useState("");
  const [text, setText] = useState("");
  const [clear, setClear] = useState<number | null>(null);
  const [dnd, setDnd] = useState<number | null>(null);
  const [dndUntil, setDndUntil] = useState<Date | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let live = true;

    trpc.chat.statusGet
      .query()
      .then((status) => {
        if (!live) return;

        setEmoji(status.emoji ?? "");
        setText(status.text ?? "");
        setDndUntil(status.dndUntil ? new Date(status.dndUntil) : null);
        setLoaded(true);
      })
      .catch(() => live && setLoaded(true));

    return () => {
      live = false;
    };
  }, [trpc]);

  const save = async (override?: {
    emoji?: string;
    text?: string;
    dndMinutes?: number | null;
  }) => {
    setSaving(true);

    try {
      const nextEmoji = override?.emoji ?? emoji;
      const nextText = override?.text ?? text;

      await trpc.chat.statusSet.mutate({
        emoji: nextEmoji.trim() || null,
        text: nextText.trim() || null,
        clearInMinutes:
          clear === null ? null : clear === -1 ? untilTomorrow(true) : clear,
        dndMinutes:
          override && "dndMinutes" in override
            ? (override.dndMinutes ?? 0)
            : dnd === null
              ? null
              : dnd === -1
                ? untilTomorrow()
                : dnd,
      });
      await sidebar.refresh();
      toastSuccess("Status saved");
      onClose();
    } catch (error) {
      toastError(error, "Could not save your status");
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="gap-4 sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-xl">Your status</DialogTitle>
          <DialogDescription>
            Shown next to your name in chat.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <Input
            value={emoji}
            maxLength={4}
            onChange={(event) => setEmoji(event.target.value)}
            aria-label="Status emoji"
            placeholder="🙂"
            className="w-14 text-center text-lg"
          />
          <Input
            value={text}
            maxLength={80}
            onChange={(event) => setText(event.target.value)}
            aria-label="Status text"
            placeholder="What’s your status?"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {statusPresets.map(([glyph, label]) => (
            <Button
              variant="custom"
              key={label}
              type="button"
              onClick={() => {
                setEmoji(glyph);
                setText(label);
              }}
              className="rounded-full border border-hairline px-2.5 py-1 text-[13px] hover:bg-hover"
            >
              {glyph} {label}
            </Button>
          ))}
        </div>

        <Label className="flex items-center gap-2 text-sm">
          <span className="w-28 text-ink-2">Clear status</span>
          <NativeSelect
            value={clear === null ? "" : String(clear)}
            onChange={(event) =>
              setClear(
                event.target.value === "" ? null : Number(event.target.value),
              )
            }
            className="flex-1"
          >
            {clearChoices.map(([label, value]) => (
              <option key={label} value={value === null ? "" : String(value)}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </Label>

        <div className="rounded-lg border border-hairline p-3">
          <p className="flex items-center gap-2 text-sm font-medium">
            <BellOffIcon className="size-4" aria-hidden="true" />
            Do not disturb
          </p>
          <p className="mt-0.5 text-[13px] text-ink-2">
            Pauses the chat badge. Messages still arrive and stay unread.
          </p>
          {dndUntil && dndUntil.getTime() > Date.now() ? (
            <div className="mt-2 flex items-center justify-between rounded-md bg-sunken px-2.5 py-1.5 text-sm">
              <span>
                On until{" "}
                {dndUntil.toLocaleString("en-US", {
                  weekday: "short",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={saving}
                onClick={() => void save({ dndMinutes: 0 })}
              >
                Turn off
              </Button>
            </div>
          ) : (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {dndChoices.map(([label, value]) => (
                <Button
                  variant="custom"
                  key={label}
                  type="button"
                  aria-pressed={dnd === value}
                  onClick={() => setDnd(dnd === value ? null : value)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[13px] hover:bg-hover",
                    dnd === value
                      ? "border-signal bg-signal-subtle"
                      : "border-hairline",
                  )}
                >
                  {label}
                </Button>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            disabled={saving}
            onClick={() => void save({ emoji: "", text: "" })}
          >
            Clear status
          </Button>
          <Button disabled={!loaded || saving} onClick={() => void save()}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
