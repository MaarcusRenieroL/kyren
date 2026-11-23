import { Label } from "@zentro/ui/shadcn/label";
import { Checkbox } from "@zentro/ui/shadcn/checkbox";
import { useEffect, useState } from "react";
import { BellIcon, BellOffIcon, PinIcon } from "lucide-react";
import { useTrpcClient } from "@zentro/api/react";
import { cn } from "@zentro/ui/lib/utils";
import { toastError } from "@zentro/ui/index";
import { Button } from "@zentro/ui/shadcn/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@zentro/ui/shadcn/popover";
import { Skeleton } from "@zentro/ui/shadcn/skeleton";
import { MessageBody, messageTime } from "../message-body";
import type { MessageView } from "../message-item";
import type { ChannelData } from "./channel-view-types";

/** The pinned messages of the channel. */
export function PinsButton({
  channelId,
  count,
  onJump,
}: {
  channelId: string;
  count: number;
  onJump: (messageId: string) => void;
}) {
  const trpc = useTrpcClient();
  const [open, setOpen] = useState(false);
  const [pins, setPins] = useState<MessageView[] | null>(null);

  useEffect(() => {
    if (!open) return;

    setPins(null);
    void trpc.chat.pins.query({ channelId }).then(setPins);
  }, [open, channelId, trpc]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 px-2 text-ink-2"
          aria-label={`${count} pinned messages`}
        >
          <PinIcon className="size-4" />
          <span className="font-mono text-xs">{count}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 gap-1 p-2">
        <p className="eyebrow px-2 pt-1 pb-1.5">Pinned</p>
        {pins === null ? (
          <Skeleton className="m-2 h-10" />
        ) : pins.length === 0 ? (
          <p className="px-2 py-3 text-sm text-ink-2">
            Nothing pinned yet. Pin a message from its menu to keep it here.
          </p>
        ) : (
          pins.map((pin) => (
            <Button
              variant="custom"
              key={pin.id}
              type="button"
              onClick={() => {
                setOpen(false);
                onJump(pin.id);
              }}
              className="flex flex-col gap-0.5 rounded-md px-2 py-1.5 text-left hover:bg-hover"
            >
              <span className="text-xs font-semibold">
                {pin.author?.name}{" "}
                <span className="font-mono font-normal text-ink-3">
                  {messageTime(pin.createdAt)}
                </span>
              </span>
              <span className="line-clamp-2 text-sm">
                <MessageBody body={pin.body} names={pin.names} />
              </span>
            </Button>
          ))
        )}
      </PopoverContent>
    </Popover>
  );
}

/** Notification settings for this conversation. */
export function NotifyButton({
  channel,
  onChanged,
}: {
  channel: ChannelData;
  onChanged: () => void;
}) {
  const trpc = useTrpcClient();
  const [open, setOpen] = useState(false);
  const muted =
    channel.notify === "mute" ||
    Boolean(channel.mutedUntil && new Date(channel.mutedUntil) > new Date());

  const save = async (values: {
    notify?: "all" | "mentions" | "mute";
    notifyReplies?: boolean;
    mutedUntil?: Date | null;
  }) => {
    try {
      await trpc.chat.setPreferences.mutate({
        channelId: channel.id,
        ...values,
      });
      onChanged();
    } catch (error) {
      toastError(error, "Could not save that");
    }
  };

  if (!channel.joined) return null;

  const tomorrow = () => {
    const date = new Date();

    date.setDate(date.getDate() + 1);
    date.setHours(9, 0, 0, 0);

    return date;
  };
  const options = [
    ["all", "All new messages", "Badge and notify for every message."],
    ["mentions", "Mentions only", "@you, @channel, @here and replies to you."],
    [
      "mute",
      "Mute",
      "No badges or notifications. Mentions still land in Mentions.",
    ],
  ] as const;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Notification settings"
          className={cn(muted && "text-ink-3")}
        >
          {muted ? (
            <BellOffIcon className="size-4" />
          ) : (
            <BellIcon className="size-4" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 gap-1 p-2">
        <p className="px-2 pt-1 pb-1 text-sm font-semibold">
          Notifications for{" "}
          {channel.kind === "dm" ? channel.title : `#${channel.name}`}
        </p>
        {options.map(([value, label, hint]) => (
          <Button
            variant="custom"
            key={value}
            type="button"
            role="radio"
            aria-checked={channel.notify === value}
            onClick={() => void save({ notify: value })}
            className={cn(
              "flex items-start gap-2.5 rounded-md px-2 py-2 text-left hover:bg-hover",
              channel.notify === value && "bg-hover",
            )}
          >
            <span
              className={cn(
                "mt-0.5 size-4 shrink-0 rounded-full border",
                channel.notify === value
                  ? "border-[5px] border-ink"
                  : "border-line-strong",
              )}
            />
            <span>
              <span className="block text-sm font-medium">{label}</span>
              <span className="block text-xs text-ink-2">{hint}</span>
            </span>
          </Button>
        ))}
        <Label className="flex items-center gap-3 border-t border-hairline px-2 pt-3 pb-1 text-sm">
          <span className="flex-1">Replies to my messages</span>
          <Checkbox
            checked={channel.notifyReplies}
            onCheckedChange={(checked) =>
              void save({ notifyReplies: checked === true })
            }
            className="size-4 accent-[var(--signal)]"
          />
        </Label>
        <Label className="flex items-center gap-3 px-2 py-1 text-sm">
          <span className="flex-1">Mute until tomorrow 09:00</span>
          <Checkbox
            checked={Boolean(
              channel.mutedUntil && new Date(channel.mutedUntil) > new Date(),
            )}
            onCheckedChange={(checked) =>
              void save({
                mutedUntil: checked === true ? tomorrow() : null,
              })
            }
            className="size-4 accent-[var(--signal)]"
          />
        </Label>
      </PopoverContent>
    </Popover>
  );
}
