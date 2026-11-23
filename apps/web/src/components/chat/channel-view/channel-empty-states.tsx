import { HashIcon } from "lucide-react";
import { Button } from "@zentro/ui/shadcn/button";
import { Avatar } from "../message-item";
import type { ChannelData } from "./channel-view-types";

export function IntroNote({ data }: { data: ChannelData }) {
  return (
    <p className="px-5 pt-3 pb-2 font-mono text-[11px] text-ink-3">
      {data.kind === "dm"
        ? `This is the start of your conversation with ${data.title}.`
        : `This is the start of #${data.name}.`}
    </p>
  );
}

export function EmptyChannel({
  data,
  onSettings,
}: {
  data: ChannelData;
  onSettings: () => void;
}) {
  const dm = data.kind === "dm";

  return (
    <div className="flex flex-col gap-3 px-8 py-10">
      <span className="flex size-12 items-center justify-center rounded-lg bg-tint-teams">
        {dm ? (
          <Avatar name={data.title} size={32} />
        ) : (
          <HashIcon className="size-6" aria-hidden="true" />
        )}
      </span>
      <h3 className="font-display text-[1.75rem] leading-9">
        {dm
          ? `Start a conversation with ${data.title}.`
          : `This is the start of #${data.name}.`}
      </h3>
      <p className="max-w-lg text-[15px] leading-[22px] text-ink-2">
        {dm
          ? "Messages here are only visible to the two of you."
          : data.link?.type === "project"
            ? `Created and linked to ${data.link.name}. Any ${data.link.key} key you mention here turns into a link to its task, and the channel shows up under Project channels.`
            : "Say hello, ask a question or share what you’re working on. Mention a task key like ZEN-18 and it links both ways."}
      </p>
      {!dm && data.canManage ? (
        <div className="flex flex-wrap items-center gap-2 pt-1 text-sm">
          <Button variant="outline" size="sm" onClick={onSettings}>
            Add people
          </Button>
          <Button variant="outline" size="sm" onClick={onSettings}>
            Set a topic
          </Button>
          <span className="font-mono text-xs text-ink-3">
            {data.people.length}{" "}
            {data.people.length === 1 ? "member" : "members"} ·{" "}
            {data.visibility === "private" ? "Private" : "Public"}
          </span>
        </div>
      ) : null}
    </div>
  );
}
