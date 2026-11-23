"use client";

import type { FC } from "react";
import {
  CheckIcon,
  CornerDownRightIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";
import { Button } from "@zentro/ui/shadcn/button";
import { Textarea } from "@zentro/ui/shadcn/textarea";
import { ActorAvatar } from "~/src/components/actor-avatar";
import { formatDocDate } from "../../../../lib/docs";
import type { DocComment } from "./types";

export const CommentItem: FC<{
  comment: DocComment;
  isReply: boolean;
  canComment: boolean;
  savingId: string | null;
  editing: { id: string; body: string } | null;
  setEditing: (val: { id: string; body: string } | null) => void;
  onSaveEdit: () => void;
  onStartReply: (id: string) => void;
  onResolve: (id: string) => void;
  onDelete: (id: string) => void;
}> = ({
  comment,
  isReply,
  canComment,
  savingId,
  editing,
  setEditing,
  onSaveEdit,
  onStartReply,
  onResolve,
  onDelete,
}) => {
  const author = comment.authorName ?? comment.authorEmail ?? "Unknown author";

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
                onClick={onSaveEdit}
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
              <Button
                variant="custom"
                type="button"
                onClick={() => onStartReply(comment.id)}
                aria-label={`Reply to ${author}`}
                className="flex items-center gap-1 rounded-xs text-ink-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
              >
                <CornerDownRightIcon className="size-3.5" />
                Reply
              </Button>
            ) : null}
            {canComment && !isReply ? (
              <Button
                variant="custom"
                type="button"
                disabled={savingId === comment.id}
                onClick={() => onResolve(comment.id)}
                className="flex items-center gap-1 rounded-xs text-signal outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              >
                <CheckIcon className="size-3.5" />
                {savingId === comment.id ? "Working..." : "Resolve"}
              </Button>
            ) : null}
            {canComment && comment.canEdit ? (
              <Button
                variant="custom"
                type="button"
                disabled={savingId === comment.id}
                onClick={() =>
                  setEditing({ id: comment.id, body: comment.body })
                }
                className="flex items-center gap-1 rounded-xs text-ink-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              >
                <PencilIcon className="size-3.5" />
                Edit
              </Button>
            ) : null}
            {canComment && comment.canDelete ? (
              <Button
                variant="custom"
                type="button"
                disabled={savingId === comment.id}
                onClick={() => onDelete(comment.id)}
                aria-label={`Delete comment by ${author}`}
                className="flex items-center gap-1 rounded-xs text-ink-2 outline-none hover:text-danger hover:underline focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              >
                <Trash2Icon className="size-3.5" />
                Delete
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
};
