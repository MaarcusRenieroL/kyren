"use client";

import { Textarea } from "@zentro/ui/shadcn/textarea";
import { Button } from "@zentro/ui/shadcn/button";
import { MessageBody } from "./message-body";

type Props = {
  canvas: string | null;
  canEdit: boolean;
  editing: boolean;
  setEditing: (editing: boolean) => void;
  draft: string;
  setDraft: (draft: string) => void;
  onSave: () => void;
};

export function ChannelCanvasPanel({
  canvas,
  canEdit,
  editing,
  setEditing,
  draft,
  setDraft,
  onSave,
}: Props) {
  return (
    <div className="rounded-lg border border-hairline bg-canvas p-3">
      {editing ? (
        <div className="flex flex-col gap-2">
          <Textarea
            value={draft}
            autoFocus
            maxLength={5000}
            rows={5}
            onChange={(event) => setDraft(event.target.value)}
            aria-label="Channel note"
            className="w-full resize-y rounded-md border border-signal bg-surface px-3 py-2 text-[14px] leading-6 outline-none"
            placeholder="Goals, rules, links people keep asking for. Supports the same formatting as messages."
          />
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={onSave}>
              Save note
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setDraft(canvas ?? "");
                setEditing(false);
              }}
            >
              Cancel
            </Button>
            <span className="ml-auto font-mono text-[11px] text-ink-3">
              {draft.length}/5000
            </span>
          </div>
        </div>
      ) : canvas ? (
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1 text-[14px] leading-6">
            <MessageBody body={canvas} names={{}} />
          </div>
          {canEdit ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditing(true)}
            >
              Edit
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3 text-ink-2">
          <span>No note yet. Use it for goals, rules and useful links.</span>
          {canEdit ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditing(true)}
            >
              Write a note
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
