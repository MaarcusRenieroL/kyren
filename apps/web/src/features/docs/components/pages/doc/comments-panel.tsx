"use client";

import { Button } from "@zentro/ui/shadcn/button";
import { Skeleton } from "@zentro/ui/shadcn/skeleton";
import { Textarea } from "@zentro/ui/shadcn/textarea";
import {
  CheckIcon,
  CornerDownRightIcon,
  PencilIcon,
  SendIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { useEffect, useState } from "react";

import { useTrpcClient } from "@zentro/api/react";
import { toastError, toastSuccess } from "@zentro/ui/index";

import { ActorAvatar } from "~/src/components/actor-avatar";

import { formatDocDate } from "../../../lib/docs";

type DocComment = {
  id: string;
  parentId: string | null;
  body: string;
  authorName: string | null;
  authorEmail: string | null;
  authorImage: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  canEdit: boolean;
  canDelete: boolean;
};

/** Open threads and their replies; a resolved thread hides with its replies. */
function openOnly(list: DocComment[]) {
  const open = new Set(
    list
      .filter((comment) => !comment.parentId && !comment.resolvedAt)
      .map((comment) => comment.id),
  );

  return list.filter((comment) => open.has(comment.parentId ?? comment.id));
}

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
    if (!body.trim() || savingId) {
      return;
    }

    try {
      setSavingId("new");
      await trpc.docs.createComment.mutate({
        docId,
        body,
      });
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
    if (!replying || !replying.body.trim() || savingId) {
      return;
    }

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
    if (!editing || !editing.body.trim() || savingId) {
      return;
    }

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
    if (!window.confirm("Delete this comment? This cannot be undone.")) {
      return;
    }

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

  function renderComment(comment: DocComment, isReply: boolean) {
    const author =
      comment.authorName ?? comment.authorEmail ?? "Unknown author";

    return (
      <div className={`flex gap-2.5 rounded-xl p-3 ${isReply ? "pt-1" : ""}`}>
        <ActorAvatar name={author} size={28} />
        <div className="min-w-0 flex-1">
          <p className="flex items-baseline gap-2 text-sm">
            <span className="truncate font-medium">{author}</span>
            <span className="font-mono text-[11px] text-ink-3">
              {formatDocDate(comment.createdAt)}
            </span>
          </p>
          {editing?.id === comment.id ? (
            <div className="mt-1 flex flex-col gap-1.5">
              <Textarea
                className="min-h-16 resize-none"
                aria-label="Edit comment"
                value={editing.body}
                onChange={(event) =>
                  setEditing({ id: comment.id, body: event.target.value })
                }
              />
              <div className="flex justify-end gap-1.5">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditing(null)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={!editing.body.trim() || savingId === comment.id}
                  onClick={saveEdit}
                >
                  {savingId === comment.id ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          ) : (
            <p className="mt-1 text-sm leading-5 text-ink-2">{comment.body}</p>
          )}
          {editing?.id !== comment.id ? (
            <div className="mt-1.5 flex items-center gap-3 text-xs">
              {canComment && !isReply ? (
                <button
                  type="button"
                  onClick={() => setReplying({ id: comment.id, body: "" })}
                  aria-label={`Reply to ${author}`}
                  className="flex items-center gap-1 rounded-xs text-ink-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <CornerDownRightIcon className="size-3.5" />
                  Reply
                </button>
              ) : null}
              {canComment && !isReply ? (
                <button
                  type="button"
                  disabled={savingId === comment.id}
                  onClick={() => resolveComment(comment.id)}
                  className="flex items-center gap-1 rounded-xs text-signal outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                >
                  <CheckIcon className="size-3.5" />
                  {savingId === comment.id ? "Working..." : "Resolve"}
                </button>
              ) : null}
              {canComment && comment.canEdit ? (
                <button
                  type="button"
                  disabled={savingId === comment.id}
                  onClick={() =>
                    setEditing({ id: comment.id, body: comment.body })
                  }
                  className="flex items-center gap-1 rounded-xs text-ink-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                >
                  <PencilIcon className="size-3.5" />
                  Edit
                </button>
              ) : null}
              {canComment && comment.canDelete ? (
                <button
                  type="button"
                  disabled={savingId === comment.id}
                  onClick={() => deleteComment(comment.id)}
                  aria-label={`Delete comment by ${author}`}
                  className="flex items-center gap-1 rounded-xs text-ink-2 outline-none hover:text-danger hover:underline focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                >
                  <Trash2Icon className="size-3.5" />
                  Delete
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  if (!isOpen) {
    return null;
  }

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
              {renderComment(thread, false)}
              {repliesOf(thread.id).map((reply) => (
                <div key={reply.id} className="ml-8">
                  {renderComment(reply, true)}
                </div>
              ))}
              {replying?.id === thread.id ? (
                <div className="ml-8 flex flex-col gap-1.5 px-3 pb-3">
                  <Textarea
                    autoFocus
                    className="min-h-16 resize-none"
                    aria-label="Reply"
                    value={replying.body}
                    onChange={(event) =>
                      setReplying({ id: thread.id, body: event.target.value })
                    }
                  />
                  <div className="flex justify-end gap-1.5">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setReplying(null)}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      disabled={
                        !replying.body.trim() ||
                        savingId === `reply:${thread.id}`
                      }
                      onClick={sendReply}
                    >
                      {savingId === `reply:${thread.id}`
                        ? "Posting..."
                        : "Send reply"}
                    </Button>
                  </div>
                </div>
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
