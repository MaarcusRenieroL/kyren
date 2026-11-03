"use client";

import { useState } from "react";

import { useTrpcClient } from "@zentro/api/react";
import { toastError } from "@zentro/ui/index";
import { EmptyState } from "@zentro/ui/components/empty-state";
import { Button } from "@zentro/ui/shadcn/button";
import { Skeleton } from "@zentro/ui/shadcn/skeleton";

import { useAsyncData } from "~/src/lib/use-async-data";

import { SettingsHeader, SettingsRow, SettingsTile } from "./settings-kit";

const kinds = [
  [
    "mention",
    "Mentions",
    "When someone @mentions you or writes to you in chat.",
  ],
  ["assignment", "Assignments", "When a task is given to you."],
  ["comment", "Comments", "Comments on your tasks and docs, and new messages."],
  ["unblock", "Unblocked tasks", "When a task you own is no longer blocked."],
] as const;

export function NotificationsSection() {
  const trpc = useTrpcClient();
  const { data, status, reload } = useAsyncData(
    () => trpc.notification.getPreferences.query(),
    [trpc],
  );
  const [overrides, setOverrides] = useState<string[] | null>(null);
  const muted = overrides ?? data?.mutedKinds ?? [];

  async function toggle(kind: string, on: boolean) {
    const previous = muted;
    const next = on ? muted.filter((k) => k !== kind) : [...muted, kind];

    setOverrides(next);
    try {
      await trpc.notification.setPreferences.mutate({
        mutedKinds: next as never,
      });
    } catch {
      setOverrides(previous);
      toastError("Could not save", "Check your connection and try again.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <SettingsHeader
        eyebrow="ACCOUNT"
        title="Notifications"
        description="Choose what appears in your inbox for this organization. Changes save as you go."
      />

      {status === "error" ? (
        <EmptyState
          title="Notification settings did not load"
          description="Check your connection and try again."
          action={<Button onClick={reload}>Retry</Button>}
        />
      ) : !data ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <SettingsTile>
          {kinds.map(([kind, label, hint]) => (
            <SettingsRow key={kind} label={label} description={hint}>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  aria-label={`Show ${label.toLowerCase()} in my inbox`}
                  className="size-4 accent-[var(--signal)]"
                  checked={!muted.includes(kind)}
                  onChange={(event) => void toggle(kind, event.target.checked)}
                />
                Show in my inbox
              </label>
            </SettingsRow>
          ))}
        </SettingsTile>
      )}
    </div>
  );
}
