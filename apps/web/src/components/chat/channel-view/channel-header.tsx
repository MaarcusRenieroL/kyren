import Link from "next/link";
import {
  BarChart3Icon,
  HashIcon,
  LockIcon,
  MoreHorizontalIcon,
  SearchIcon,
  SettingsIcon,
  SparklesIcon,
  VideoIcon,
} from "lucide-react";
import { Button } from "@zentro/ui/shadcn/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@zentro/ui/shadcn/dropdown-menu";
import { Avatar } from "../message-item";
import type { ChannelData } from "./channel-view-types";
import { NotifyButton, PinsButton } from "./channel-header-buttons";

export function ChannelHeader({
  data,
  isDm,
  canPost,
  others,
  onSettings,
  onHuddle,
  onPoll,
  onSummarize,
  onJumpPin,
  onChanged,
}: {
  data: ChannelData;
  isDm: boolean;
  canPost: boolean;
  others: Array<{
    memberId: string;
    name: string;
    presence?: "active" | "away" | "offline";
  }>;
  onSettings: () => void;
  onHuddle: () => void;
  onPoll: () => void;
  onSummarize: () => void;
  onJumpPin: (messageId: string) => void;
  onChanged: () => void;
}) {
  return (
    <header className="flex items-center gap-3 border-b border-hairline px-5 py-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-hairline bg-tint-teams">
        {isDm ? (
          others[0] ? (
            <Avatar
              name={others[0].name}
              presence={others[0].presence}
              size={28}
            />
          ) : null
        ) : data.visibility === "private" ? (
          <LockIcon className="size-4" aria-hidden="true" />
        ) : (
          <HashIcon className="size-4" aria-hidden="true" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h2 className="truncate text-lg leading-6 font-semibold">
            {isDm ? data.title : data.name}
          </h2>
          {data.link ? (
            <Link
              href={data.link.href}
              className="flex items-center gap-1.5 text-[13px] text-signal-strong hover:underline"
            >
              {data.link.key ? (
                <span className="rounded-xs border border-hairline px-1 font-mono text-[10px] text-ink-2">
                  {data.link.key}
                </span>
              ) : null}
              {data.link.name}
            </Link>
          ) : null}
          {data.archivedAt ? (
            <span className="rounded-sm border border-hairline px-1.5 font-mono text-[10px] text-ink-2 uppercase">
              Archived
            </span>
          ) : null}
        </div>
        {!isDm ? (
          <p className="truncate text-[13px] text-ink-2">
            {data.topic || "No topic yet"}
          </p>
        ) : null}
      </div>

      {!isDm ? (
        <Button
          variant="custom"
          type="button"
          onClick={onSettings}
          aria-label={`${data.people.length} members`}
          className="hidden items-center gap-2 rounded-full border border-hairline px-2 py-1 outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-ring sm:flex"
        >
          <span className="flex">
            {data.people.slice(0, 3).map((person) => (
              <span
                key={person.memberId}
                className="-ml-1.5 rounded-full ring-2 ring-canvas first:ml-0"
              >
                <Avatar name={person.name} size={20} />
              </span>
            ))}
          </span>
          <span className="font-mono text-xs text-ink-2">
            {data.people.length}
          </span>
        </Button>
      ) : null}
      {canPost ? (
        <>
          <Button
            variant="ghost"
            size="icon-sm"
            className="hidden sm:inline-flex"
            aria-label="Start a huddle"
            title="Start a huddle"
            onClick={onHuddle}
          >
            <VideoIcon className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="hidden sm:inline-flex"
            aria-label="Create a poll"
            title="Create a poll"
            onClick={onPoll}
          >
            <BarChart3Icon className="size-4" />
          </Button>
        </>
      ) : null}
      <Button
        variant="ghost"
        size="icon-sm"
        className="hidden sm:inline-flex"
        aria-label="Summarize this conversation"
        title="Summarize"
        onClick={onSummarize}
      >
        <SparklesIcon className="size-4" />
      </Button>
      <PinsButton
        channelId={data.id}
        count={data.pinCount}
        onJump={onJumpPin}
      />
      <NotifyButton channel={data} onChanged={onChanged} />
      <Button
        asChild
        variant="ghost"
        size="icon-sm"
        className="hidden sm:inline-flex"
        aria-label="Search this channel"
      >
        <Link href={`/chat/search?in=${data.id}`}>
          <SearchIcon className="size-4" />
        </Link>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="sm:hidden"
            aria-label="More channel actions"
          >
            <MoreHorizontalIcon className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {canPost ? (
            <>
              <DropdownMenuItem onClick={onHuddle}>
                <VideoIcon className="size-4" />
                Start a huddle
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onPoll}>
                <BarChart3Icon className="size-4" />
                Create a poll
              </DropdownMenuItem>
            </>
          ) : null}
          <DropdownMenuItem onClick={onSummarize}>
            <SparklesIcon className="size-4" />
            Summarize
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/chat/search?in=${data.id}`}>
              <SearchIcon className="size-4" />
              Search this channel
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {!isDm ? (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Channel settings"
          onClick={onSettings}
        >
          <SettingsIcon className="size-4" />
        </Button>
      ) : null}
    </header>
  );
}
