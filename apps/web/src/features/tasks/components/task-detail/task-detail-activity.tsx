"use client";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@zentro/ui/shadcn/tabs";
import type { MemberOption, TaskActivityEvent, TaskComment } from "./types";
import { CommentComposer } from "./activity/comment-composer";
import { CommentList, ActivityList } from "./activity/activity-list";

type Props = {
  members: MemberOption[];
  comments: TaskComment[];
  activityEvents: TaskActivityEvent[];
  commentDisabled: boolean;
  onAddComment: (body: string) => void;
  canComment?: boolean;
};

const tabTrigger =
  "h-full flex-none rounded-none px-0 text-sm font-normal data-[state=active]:font-medium";

export function TaskDetailActivity({
  members,
  comments,
  activityEvents,
  commentDisabled,
  onAddComment,
  canComment = true,
}: Props) {
  const historyEvents = activityEvents.filter(
    (event) => event.type !== "comment.created",
  );

  return (
    <section aria-label="Activity" className="flex flex-col">
      <Tabs defaultValue="comments" className="flex-col gap-3.5">
        <TabsList
          variant="line"
          className="h-auto w-full justify-start gap-5 group-data-horizontal/tabs:h-9"
        >
          <TabsTrigger value="comments" className={tabTrigger}>
            Comments
            <span className="font-mono text-xs text-ink-3">
              {comments.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="history" className={tabTrigger}>
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="comments"
          className="m-0 flex min-w-0 flex-col gap-3.5"
        >
          <CommentList comments={comments} />
          {canComment ? (
            <CommentComposer
              disabled={commentDisabled}
              onAddComment={onAddComment}
            />
          ) : (
            <p className="text-sm text-ink-3">
              You do not have permission to comment on this task.
            </p>
          )}
        </TabsContent>

        <TabsContent value="history" className="m-0 min-w-0">
          <ActivityList members={members} events={historyEvents} />
        </TabsContent>
      </Tabs>
    </section>
  );
}
