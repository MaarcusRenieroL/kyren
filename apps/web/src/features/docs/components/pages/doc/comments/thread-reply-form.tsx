"use client";

import type { FC } from "react";
import { Button } from "@kyren/ui/shadcn/button";
import { Textarea } from "@kyren/ui/shadcn/textarea";

export const ThreadReplyForm: FC<{
  threadId: string;
  replyingBody: string;
  isSaving: boolean;
  onChange: (val: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
}> = ({
  replyingBody,
  isSaving,
  onChange,
  onCancel,
  onSubmit,
}) => {
  return (
    <div className="ml-8 flex flex-col gap-1.5 px-3 pb-3">
      <Textarea
        autoFocus
        className="min-h-16 resize-none"
        aria-label="Reply"
        value={replyingBody}
        onChange={(event) => onChange(event.target.value)}
      />
      <div className="flex justify-end gap-1.5">
        <Button
          size="sm"
          variant="ghost"
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          size="sm"
          disabled={!replyingBody.trim() || isSaving}
          onClick={onSubmit}
        >
          {isSaving ? "Posting..." : "Send reply"}
        </Button>
      </div>
    </div>
  );
};
