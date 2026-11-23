import type { ReactNode } from "react";
import { CircleDotIcon, HistoryIcon, MessageSquareIcon } from "lucide-react";
import { RichTextPreview } from "@zentro/ui/components/rich-text-editor";
import { AvatarInitials } from "../avatar-initials";
import type { MemberOption, TaskActivityEvent, TaskComment } from "../types";
import { formatActivityDate, getActivityLabel } from "./activity-helpers";

export function CommentList({ comments }: { comments: TaskComment[] }) {
  if (!comments.length) {
    return (
      <p className="text-sm text-ink-3">
        No comments yet. Start the conversation with context, decisions or
        blockers.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3.5">
      {comments.map((comment) => {
        const author = comment.authorName ?? comment.authorEmail ?? "Unknown";

        return (
          <article key={comment.id} className="flex gap-3">
            <AvatarInitials value={author} size={32} />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-sm font-semibold">{author}</span>
                <span className="font-mono text-xs text-ink-3">
                  {formatActivityDate(comment.createdAt)}
                </span>
              </div>
              <RichTextPreview
                value={comment.body}
                className="min-h-0 rounded-none p-0 text-[15px] leading-[22px] text-ink"
              />
            </div>
          </article>
        );
      })}
    </div>
  );
}

export function ActivityList({
  events,
  members,
  includeComments = false,
}: {
  events: TaskActivityEvent[];
  members: MemberOption[];
  includeComments?: boolean;
}) {
  const visibleEvents = includeComments
    ? events
    : events.filter((event) => event.type !== "comment.created");

  if (!visibleEvents.length) {
    return (
      <ActivityEmptyState
        icon={<HistoryIcon className="size-4" />}
        title="No activity yet"
        message="Task updates, comments, and changes will appear here."
      />
    );
  }

  return (
    <div className="relative before:absolute before:left-[11px] before:top-3 before:h-[calc(100%-1.5rem)] before:w-px before:bg-border">
      {visibleEvents.map((event) => {
        const actor = event.actorName ?? event.actorEmail ?? "Unknown";
        const label = getActivityLabel(event, members);

        return (
          <div
            key={event.id}
            className="relative flex gap-3 rounded-md px-1 py-2 hover:bg-muted/30"
          >
            <span className="relative z-10 mt-0.5 flex size-5 items-center justify-center rounded-full border bg-background">
              {event.type === "comment.created" ? (
                <MessageSquareIcon className="size-3 text-primary" />
              ) : (
                <CircleDotIcon className="size-3 text-muted-foreground" />
              )}
            </span>
            <div className="min-w-0 flex-1 text-sm">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="font-semibold">{actor}</span>
                <span className="text-muted-foreground">{label}</span>
                <span className="text-xs text-muted-foreground">
                  {formatActivityDate(event.createdAt)}
                </span>
              </div>
              {event.commentBody ? (
                <RichTextPreview
                  value={event.commentBody}
                  className="mt-2 min-h-0 rounded-md bg-muted/40 px-3 py-2"
                />
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ActivityEmptyState({
  icon,
  title,
  message,
}: {
  icon: ReactNode;
  title: string;
  message: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-dashed bg-muted/20 p-4">
      <span className="flex size-8 items-center justify-center rounded-full bg-background text-muted-foreground">
        {icon}
      </span>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
