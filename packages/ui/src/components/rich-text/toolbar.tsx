"use client";

import { useState, type ReactNode } from "react";
import {
  BoldIcon,
  CheckIcon,
  CodeIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  HighlighterIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  MoreHorizontalIcon,
  PilcrowIcon,
  QuoteIcon,
  Redo2Icon,
  StrikethroughIcon,
  UnderlineIcon,
  Undo2Icon,
  XIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Editor } from "@tiptap/react";
import { cn } from "../../lib/utils";
import { Button } from "../shadcn/button";
import { MoreItem, ToolbarButton } from "./toolbar-buttons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../shadcn/dropdown-menu";
import { Input } from "../shadcn/input";
import { Popover, PopoverContent, PopoverTrigger } from "../shadcn/popover";

type RichTextToolbarProps = {
  editor: Editor;
  disabled?: boolean;
};

function RichTextToolbar({ editor, disabled }: RichTextToolbarProps) {
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);

  const applyLink = () => {
    const href = /^(https?:\/\/|mailto:)/.test(url.trim())
      ? url.trim()
      : `https://${url.trim()}`;

    try {
      new URL(href);
    } catch {
      setUrlError("Enter a web address like https://example.com");

      return;
    }

    setUrlError(null);
    editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    setUrl("");
    setLinkOpen(false);
  };

  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      className="flex items-center gap-0.5 border-b border-hairline px-1.5 py-1 text-ink-2"
    >
      <ToolbarButton
        label="Bold"
        active={editor.isActive("bold")}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <BoldIcon className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Italic"
        active={editor.isActive("italic")}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <ItalicIcon className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Bulleted list"
        active={editor.isActive("bulletList")}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <ListIcon className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Checklist"
        active={editor.isActive("taskList")}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleTaskList().run()}
      >
        <CheckIcon className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Code"
        active={editor.isActive("code")}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleCode().run()}
      >
        <CodeIcon className="size-4" />
      </ToolbarButton>
      <Popover open={linkOpen} onOpenChange={setLinkOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant={editor.isActive("link") ? "secondary" : "ghost"}
            size="icon-sm"
            className="size-8"
            disabled={disabled}
            aria-label="Link"
            title="Link"
          >
            <LinkIcon className="size-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 space-y-3 p-3">
          <Input
            aria-label="Web address"
            placeholder="https://example.com"
            value={url}
            aria-invalid={Boolean(urlError)}
            onChange={(event) => setUrl(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                applyLink();
              }
            }}
          />
          {urlError ? (
            <p role="alert" className="text-xs text-danger-text">
              {urlError}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button size="sm" type="button" onClick={applyLink}>
              Add link
            </Button>
            {editor.isActive("link") ? (
              <Button
                size="sm"
                type="button"
                variant="ghost"
                onClick={() => {
                  editor.chain().focus().unsetLink().run();
                  setLinkOpen(false);
                }}
              >
                Remove
              </Button>
            ) : null}
          </div>
        </PopoverContent>
      </Popover>

      <span aria-hidden="true" className="mx-1 h-4 w-px bg-hairline" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            className="shrink-0 text-ink-2"
          >
            <MoreHorizontalIcon className="size-4" />
            More
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <MoreItem
            icon={PilcrowIcon}
            label="Paragraph"
            onSelect={() => editor.chain().focus().setParagraph().run()}
          />
          <MoreItem
            icon={Heading1Icon}
            label="Heading 1"
            onSelect={() =>
              editor.chain().focus().toggleHeading({ level: 1 }).run()
            }
          />
          <MoreItem
            icon={Heading2Icon}
            label="Heading 2"
            onSelect={() =>
              editor.chain().focus().toggleHeading({ level: 2 }).run()
            }
          />
          <MoreItem
            icon={Heading3Icon}
            label="Heading 3"
            onSelect={() =>
              editor.chain().focus().toggleHeading({ level: 3 }).run()
            }
          />
          <DropdownMenuSeparator />
          <MoreItem
            icon={UnderlineIcon}
            label="Underline"
            hint="Ctrl+U"
            onSelect={() => editor.chain().focus().toggleUnderline().run()}
          />
          <MoreItem
            icon={StrikethroughIcon}
            label="Strikethrough"
            hint="Ctrl+Shift+S"
            onSelect={() => editor.chain().focus().toggleStrike().run()}
          />
          <MoreItem
            icon={HighlighterIcon}
            label="Highlight"
            hint="Ctrl+Shift+H"
            onSelect={() => editor.chain().focus().toggleHighlight().run()}
          />
          <DropdownMenuSeparator />
          <MoreItem
            icon={ListOrderedIcon}
            label="Numbered list"
            onSelect={() => editor.chain().focus().toggleOrderedList().run()}
          />
          <MoreItem
            icon={QuoteIcon}
            label="Quote"
            onSelect={() => editor.chain().focus().toggleBlockquote().run()}
          />
          <MoreItem
            icon={CodeIcon}
            label="Code block"
            onSelect={() => editor.chain().focus().toggleCodeBlock().run()}
          />
          <DropdownMenuSeparator />
          <MoreItem
            icon={Undo2Icon}
            label="Undo"
            hint="Ctrl+Z"
            disabled={!editor.can().undo()}
            onSelect={() => editor.chain().focus().undo().run()}
          />
          <MoreItem
            icon={Redo2Icon}
            label="Redo"
            hint="Ctrl+Shift+Z"
            disabled={!editor.can().redo()}
            onSelect={() => editor.chain().focus().redo().run()}
          />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export { RichTextToolbar };
