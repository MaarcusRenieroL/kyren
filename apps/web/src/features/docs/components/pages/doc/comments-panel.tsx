"use client";

import { useEffect, useState } from "react";
import { SendIcon, XIcon } from "lucide-react";
import { Button } from "@kyren/ui/shadcn/button";
import { Skeleton } from "@kyren/ui/shadcn/skeleton";
import { Textarea } from "@kyren/ui/shadcn/textarea";
import { useTrpcClient } from "@kyren/api/react";
import { toastError, toastSuccess } from "@kyren/ui/index";
import { type DocComment, openOnly } from "./comments/types";
import { CommentItem } from "./comments/comment-item";
import { ThreadReplyForm } from "./comments/thread-reply-form";

type CommentsPanelProps = {
  docId: string;
  canComment?: boolean;
  isOpen: boolean;
  onClose: () => void;
  /** Told how many comments are open, for the count in the top bar. */
  onCount?: (count: number) => void;
};

export function CommentsPanel({
  docId,
  canComment = true,
  isOpen,
  onClose,
  onCount,
}: CommentsPanelProps) {
  const trpc = useTrpcClient();
  const [comments, setComments] = useState<DocComment[]>([]);
  // Open threads, each with its replies in order.
  const threads = comments.filter((comment) => !comment.parentId);
  const repliesOf = (id: string) =>
    comments.filter((comment) => comment.parentId === id);

  useEffect(() => {
    onCount?.(threads.length);
  }, [threads.length, onCount]);

  const [replying, setReplying] = useState<{ id: string; body: string } | null>(
    null,
  );
  const [body, setBody] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(
    null,
  );

  async function fetchComments() {
    setComments(openOnly(await trpc.docs.getComments.query({ docId })));
  }

  useEffect(() => {
    let isMounted = true;

    async function loadComments() {
      try {
        const commentList = await trpc.docs.getComments.query({ docId });
        if (isMounted) {
          setComments(openOnly(commentList));
        }
      } catch (error) {
        toastError(error, "Failed to load comments");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadComments();

    return () => {
      isMounted = false;
    };
  }, [docId, trpc]);

  async function createComment() {
    if (!body.trim() || savingId) return;

    try {
      setSavingId("new");
      await trpc.docs.createComment.mutate({ docId, body });
      setBody("");
      await fetchComments();
      toastSuccess("Comment added");
    } catch (error) {
      toastError(error, "Failed to add comment");
    } finally {
      setSavingId(null);
    }
  }

  async function sendReply() {
    if (!replying || !replying.body.trim() || savingId) return;

    try {
      setSavingId(`reply:${replying.id}`);
      await trpc.docs.createComment.mutate({
        docId,
        body: replying.body,
        parentId: replying.id,
      });
      setReplying(null);
      await fetchComments();
      toastSuccess("Reply added");
    } catch (error) {
      toastError(error, "Failed to add reply");
    } finally {
      setSavingId(null);
    }
  }

  async function resolveComment(id: string) {
    try {
      setSavingId(id);
      await trpc.docs.resolveComment.mutate({ id });
      await fetchComments();
      toastSuccess("Comment resolved");
    } catch (error) {
      toastError(error, "Failed to resolve comment");
    } finally {
      setSavingId(null);
    }
  }

  async function saveEdit() {
    if (!editing || !editing.body.trim() || savingId) return;

    try {
      setSavingId(editing.id);
      await trpc.docs.editComment.mutate(editing);
      setEditing(null);
      await fetchComments();
      toastSuccess("Comment updated");
    } catch (error) {
      toastError(error, "Failed to update comment");
    } finally {
      setSavingId(null);
    }
  }

  async function deleteComment(id: string) {
    if (!window.confirm("Delete this comment? This cannot be undone.")) return;

    try {
      setSavingId(id);
      await trpc.docs.deleteComment.mutate({ id });
      await fetchComments();
      toastSuccess("Comment deleted");
    } catch (error) {
      toastError(error, "Failed to delete comment");
    } finally {
      setSavingId(null);
    }
  }

  if (!isOpen) return null;

  return (
    <aside
      aria-label="Comments"
      className="fixed inset-y-0 right-0 z-40 w-full max-w-sm overflow-y-auto bg-surface shadow-xl xl:static xl:z-auto xl:max-w-none xl:overflow-visible xl:rounded-[20px] xl:border xl:border-hairline xl:shadow-none"
    >
      <div className="flex flex-col">
        <div className="flex items-center gap-2 px-[18px] pt-4 pb-3">
          <h2 className="text-[15px] font-semibold">Comments</h2>
          <span className="rounded-full border border-hairline px-2 py-px font-mono text-xs text-ink-2">
            {threads.length} open
          </span>
          <span className="flex-1" />
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <XIcon className="size-4" />
            <span className="sr-only">Hide comments</span>
          </Button>
        </div>

        <div className="flex flex-col px-2 pb-2">
          {isLoading ? (
            <div className="flex flex-col gap-2 p-2">
              {Array.from({ length: 2 }).map((_, index) => (
                <Skeleton key={index} className="h-20" />
              ))}
            </div>
          ) : null}

          {!isLoading && !comments.length ? (
            <p className="px-3 py-6 text-center text-sm text-ink-2">
              No open comments. Leave a note when something needs review.
            </p>
          ) : null}

          {threads.map((thread) => (
            <div
              key={thread.id}
              className="flex flex-col border-t border-hairline/60 first:border-t-0"
            >
              <CommentItem
                comment={thread}
                isReply={false}
                canComment={canComment}
                savingId={savingId}
                editing={editing}
                setEditing={setEditing}
                onSaveEdit={saveEdit}
                onStartReply={(id) => setReplying({ id, body: "" })}
                onResolve={resolveComment}
                onDelete={deleteComment}
              />
              {repliesOf(thread.id).map((reply) => (
                <div key={reply.id} className="ml-8">
                  <CommentItem
                    comment={reply}
                    isReply={true}
                    canComment={canComment}
                    savingId={savingId}
                    editing={editing}
                    setEditing={setEditing}
                    onSaveEdit={saveEdit}
                    onStartReply={(id) => setReplying({ id, body: "" })}
                    onResolve={resolveComment}
                    onDelete={deleteComment}
                  />
                </div>
              ))}
              {replying?.id === thread.id ? (
                <ThreadReplyForm
                  threadId={thread.id}
                  replyingBody={replying.body}
                  isSaving={savingId === `reply:${thread.id}`}
                  onChange={(val) =>
                    setReplying({ id: thread.id, body: val })
                  }
                  onCancel={() => setReplying(null)}
                  onSubmit={sendReply}
                />
              ) : null}
            </div>
          ))}
        </div>

        {canComment ? (
          <div className="flex flex-col gap-2 border-t border-hairline p-3">
            <Textarea
              className="min-h-20 resize-none"
              placeholder="Add a comment..."
              aria-label="Add a comment"
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />
            <Button
              size="sm"
              className="self-end"
              disabled={!body.trim() || savingId === "new"}
              onClick={createComment}
            >
              <SendIcon />
              {savingId === "new" ? "Posting..." : "Comment"}
            </Button>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
