"use client";

import { useState, type KeyboardEvent } from "react";
import { Kbd } from "@kyren/ui/components/kbd";
import { RichTextEditor } from "@kyren/ui/components/rich-text-editor";
import { Button } from "@kyren/ui/shadcn/button";

export function CommentComposer({
  disabled,
  onAddComment,
}: {
  disabled: boolean;
  onAddComment: (body: string) => void;
}) {
  const [isComposing, setIsComposing] = useState(false);
  const [draft, setDraft] = useState("");
  const [editorKey, setEditorKey] = useState(0);
  const empty = !draft || draft === "<p></p>";

  const send = () => {
    if (empty || disabled) return;
    onAddComment(draft);
    setDraft("");
    setEditorKey((key) => key + 1);
    setIsComposing(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      send();
    }
  };

  return (
    <div
      onKeyDown={onKeyDown}
      className="flex flex-col gap-2.5 rounded-xl border border-hairline bg-surface p-3"
    >
      {isComposing ? (
        <RichTextEditor
          key={editorKey}
          value=""
          disabled={disabled}
          showActions={false}
          placeholder="Write a comment."
          minHeightClassName="[&_.ProseMirror]:min-h-16"
          onChange={setDraft}
          onSave={setDraft}
        />
      ) : (
        <Button
          variant="custom"
          type="button"
          onClick={() => setIsComposing(true)}
          className="min-h-11 rounded-md px-0.5 text-left text-[15px] text-ink-3 outline-none hover:text-ink-2 focus-visible:ring-2 focus-visible:ring-ring"
        >
          Write a comment.
        </Button>
      )}
      <div className="flex items-center gap-2">
        <span className="flex-1" />
        {isComposing ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setDraft("");
              setEditorKey((key) => key + 1);
              setIsComposing(false);
            }}
          >
            Cancel
          </Button>
        ) : null}
        <Button
          variant="outline"
          onClick={() => (isComposing ? send() : setIsComposing(true))}
          disabled={disabled}
          className="h-8 border-hairline bg-transparent px-3 text-[13px]"
        >
          Comment
          <Kbd className="ml-1">⌘↵</Kbd>
        </Button>
      </div>
    </div>
  );
}
