"use client";

import { useEffect, useMemo, useState } from "react";
import CharacterCount from "@tiptap/extension-character-count";
import Highlight from "@tiptap/extension-highlight";
import TiptapLink from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import Typography from "@tiptap/extension-typography";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { SaveIcon, XIcon } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "../shadcn/button";
import { editorShellClassName, type RichTextEditorProps } from "./styles";
import { RichTextToolbar } from "./toolbar";

export function RichTextEditor({
  value,
  placeholder = "Write a clear description...",
  maxLength = 10000,
  minHeightClassName,
  disabled = false,
  showActions = true,
  onChange,
  onSave,
  onCancel,
}: RichTextEditorProps) {
  const [draft, setDraft] = useState(value);

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        // Configured on its own below.
        link: false,
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Placeholder.configure({ placeholder }),
      TiptapLink.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: {
          rel: "noopener noreferrer nofollow",
          target: "_blank",
        },
      }),
      Highlight,
      TaskList,
      TaskItem.configure({ nested: true }),
      Typography,
      CharacterCount.configure({ limit: maxLength }),
    ],
    [maxLength, placeholder],
  );

  const editor = useEditor({
    extensions,
    content: value,
    editable: !disabled,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "rich-text-editor-content",
      },
    },
    onUpdate({ editor }) {
      const nextValue = editor.getHTML();

      setDraft(nextValue);
      onChange?.(nextValue);
    },
  });

  useEffect(() => {
    if (!editor) {
      return;
    }

    editor.setEditable(!disabled);
  }, [disabled, editor]);

  useEffect(() => {
    if (!editor || value === editor.getHTML()) {
      return;
    }

    editor.commands.setContent(value || "");
    setDraft(value);
  }, [editor, value]);

  if (!editor) {
    return (
      <div className="min-h-44 animate-pulse rounded-md border bg-muted/40" />
    );
  }

  const characterCount = editor.storage.characterCount.characters();
  // An emptied editor holds "<p></p>", which is no change from "".
  const clean = (html: string) => (html === "<p></p>" ? "" : html);
  const actions =
    showActions === "dirty"
      ? clean(draft) !== clean(value ?? "")
      : Boolean(showActions);
  const isOverLimit = characterCount > maxLength;

  return (
    <div className="overflow-hidden rounded-md border border-hairline bg-surface">
      <RichTextToolbar editor={editor} disabled={disabled} />
      <EditorContent
        editor={editor}
        className={cn(editorShellClassName, minHeightClassName)}
      />
      {actions || characterCount > maxLength * 0.8 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-hairline px-3 py-2">
          <p
            className={cn(
              "text-xs text-muted-foreground",
              isOverLimit && "text-destructive",
            )}
          >
            {characterCount.toLocaleString()} / {maxLength.toLocaleString()}{" "}
            characters
          </p>
          {actions ? (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                disabled={disabled}
                onClick={() => {
                  editor.commands.setContent(value || "");
                  setDraft(value);
                  onCancel?.();
                }}
              >
                <XIcon className="size-4" />
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={disabled || isOverLimit || draft === value}
                onClick={() => onSave(draft)}
              >
                <SaveIcon className="size-4" />
                Save
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

type RichTextToolbarProps = {
  editor: Editor;
  disabled: boolean;
};

/**
 * Six everyday actions stay in view; the rest is behind More. Every command
 * keeps its keyboard shortcut (the editor provides them), so nothing is lost.
 */
