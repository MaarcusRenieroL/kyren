"use client";

import { useState } from "react";
import { HashIcon, LockIcon } from "lucide-react";
import { useTrpcClient } from "@zentro/api/react";
import { toastError, toastSuccess } from "@zentro/ui/index";
import { cn } from "@zentro/ui/lib/utils";
import { Button } from "@zentro/ui/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@zentro/ui/shadcn/dialog";

import { AboutTab } from "./channel-settings/about-tab";
import { ArchiveTab } from "./channel-settings/archive-tab";
import { DataTab } from "./channel-settings/data-tab";
import { MembersTab } from "./channel-settings/members-tab";
import { NotificationsTab } from "./channel-settings/notifications-tab";
import type { ChannelData } from "./channel-view";
import type { Person } from "./composer";

type Tab = "about" | "members" | "notifications" | "data" | "archive";

/** Name, people, your notifications and archive for one channel. */
export function ChannelSettingsDialog({
  channel,
  people,
  onClose,
  onChanged,
}: {
  channel: ChannelData;
  people: Person[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const trpc = useTrpcClient();
  const [tab, setTab] = useState<Tab>("members");
  const [name, setName] = useState(channel.name);
  const [topic, setTopic] = useState(channel.topic ?? "");
  const [description, setDescription] = useState(channel.description ?? "");
  const [visibility, setVisibility] = useState(channel.visibility);
  const fixedLink =
    channel.link?.type === "task" || channel.link?.type === "doc";
  const [link, setLink] = useState<{
    type: "team" | "project";
    id: string;
  } | null>(
    channel.link && !fixedLink
      ? { type: channel.link.type as "team" | "project", id: channel.link.id }
      : null,
  );
  const [busy, setBusy] = useState(false);
  const canManage = channel.canManage;

  const dirty =
    name !== channel.name ||
    topic !== (channel.topic ?? "") ||
    description !== (channel.description ?? "") ||
    visibility !== channel.visibility ||
    (!fixedLink && link?.id !== channel.link?.id);

  const call = async (action: () => Promise<unknown>, done?: string) => {
    setBusy(true);

    try {
      await action();
      if (done) toastSuccess(done);
      onChanged();
    } catch (error) {
      toastError(error, "That didn’t work");
    } finally {
      setBusy(false);
    }
  };

  const tabs: Array<[Tab, string, number?]> = [
    ["about", "About"],
    ["members", "Members", channel.people.length],
    ["notifications", "Notifications"],
    ["data", "Activity & data"],
    ["archive", channel.archivedAt ? "Restore" : "Archive"],
  ];

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[min(720px,90svh)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[640px]">
        <DialogHeader className="flex-row items-center gap-3 px-6 pt-5">
          <span className="flex size-9 items-center justify-center rounded-md bg-tint-teams">
            {channel.visibility === "private" ? (
              <LockIcon className="size-4" aria-hidden="true" />
            ) : (
              <HashIcon className="size-4" aria-hidden="true" />
            )}
          </span>
          <DialogTitle className="text-lg">{channel.name} settings</DialogTitle>
        </DialogHeader>

        <div
          role="tablist"
          aria-label="Channel settings"
          className="flex gap-5 border-b border-hairline px-6 pt-3 text-[15px]"
        >
          {tabs.map(([value, label, count]) => (
            <Button
              variant="custom"
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={cn(
                "-mb-px border-b-2 py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ring",
                tab === value
                  ? "border-ink font-medium"
                  : "border-transparent text-ink-2 hover:text-ink",
              )}
            >
              {label}
              {count !== undefined ? (
                <span className="ml-1.5 font-mono text-xs text-ink-3">
                  {count}
                </span>
              ) : null}
            </Button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {tab === "about" ? (
            <AboutTab
              channel={channel}
              name={name}
              setName={setName}
              topic={topic}
              setTopic={setTopic}
              description={description}
              setDescription={setDescription}
              visibility={visibility}
              setVisibility={setVisibility}
              fixedLink={fixedLink}
              link={link}
              setLink={setLink}
              canManage={canManage}
            />
          ) : null}

          {tab === "members" ? (
            <MembersTab
              channel={channel}
              people={people}
              canManage={canManage}
              busy={busy}
              call={call}
            />
          ) : null}

          {tab === "notifications" ? (
            <NotificationsTab channel={channel} busy={busy} call={call} />
          ) : null}

          {tab === "data" ? (
            <DataTab
              channel={channel}
              canManage={canManage}
              busy={busy}
              call={call}
            />
          ) : null}

          {tab === "archive" ? (
            <ArchiveTab
              channel={channel}
              canManage={canManage}
              busy={busy}
              call={call}
            />
          ) : null}
        </div>

        <DialogFooter className="items-center border-t border-hairline px-6 py-3 sm:justify-between">
          <span className="text-[13px] text-ink-3">
            {tab === "about" && dirty
              ? "You have unsaved changes."
              : "Changes save as you make them."}
          </span>
          <div className="flex gap-2">
            {tab === "about" && dirty ? (
              <Button
                disabled={busy || name.trim().length < 2}
                onClick={() =>
                  void call(
                    () =>
                      trpc.chat.update.mutate({
                        channelId: channel.id,
                        name,
                        topic: topic || null,
                        description: description || null,
                        visibility,
                        ...(fixedLink ? {} : { link }),
                      }),
                    "Saved",
                  )
                }
              >
                Save changes
              </Button>
            ) : null}
            <Button variant="outline" onClick={onClose}>
              Done
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
