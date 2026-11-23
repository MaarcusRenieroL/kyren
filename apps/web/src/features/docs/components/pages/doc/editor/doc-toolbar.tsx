import { useState } from "react";
import { useEditorState } from "@tiptap/react";
import {
  AtSignIcon,
  BoldIcon,
  CheckSquareIcon,
  Code2Icon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  MoreHorizontalIcon,
  QuoteIcon,
  SparklesIcon,
  TableIcon,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@zentro/ui/shadcn/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@zentro/ui/shadcn/dropdown-menu";
import { Input } from "@zentro/ui/shadcn/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@zentro/ui/shadcn/popover";
import { cn } from "@zentro/ui/lib/utils";
import {
  headingOptions,
  slashCommands,
  type SlashAction,
  type ToolbarProps,
} from "./doc-toolbar-constants";

export { headingOptions, slashCommands };
export type { SlashAction, ToolbarProps };

/** Six everyday actions, and everything else behind More. */
export function DocToolbar({
  editor,
  canEdit,
  onAction,
  onHeading,
  onConvertToTask,
  onMention,
}: ToolbarProps) {
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current?.isActive("bold") ?? false,
      italic: current?.isActive("italic") ?? false,
      list: current?.isActive("bulletList") ?? false,
      checklist: current?.isActive("taskList") ?? false,
      code: current?.isActive("code") ?? false,
      link: current?.isActive("link") ?? false,
    }),
  });
  const active = state ?? {
    bold: false,
    italic: false,
    list: false,
    checklist: false,
    code: false,
    link: false,
  };
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);

  if (!canEdit || !editor) return null;

  const apply = () => {
    const href = /^https?:\/\//.test(url.trim())
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
  };

  const button = (
    label: string,
    Icon: LucideIcon,
    pressed: boolean,
    run: () => void,
  ) => (
    <Button
      key={label}
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      aria-pressed={pressed}
      onClick={run}
      className={cn(
        "size-8",
        pressed ? "bg-selected text-signal" : "text-ink-2",
      )}
    >
      <Icon className="size-4" />
    </Button>
  );

  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      className="tile tab-scroll mb-5 flex items-center gap-1 p-1.5 [&>*]:shrink-0"
    >
      {button("Bold", BoldIcon, active.bold, () =>
        editor.chain().focus().toggleBold().run(),
      )}
      {button("Italic", ItalicIcon, active.italic, () =>
        editor.chain().focus().toggleItalic().run(),
      )}
      {button("Bulleted list", ListIcon, active.list, () =>
        onAction("bullet-list"),
      )}
      {button("Checklist", CheckSquareIcon, active.checklist, () =>
        onAction("task-list"),
      )}
      {button("Code", Code2Icon, active.code, () => onAction("inline-code"))}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Link"
            aria-pressed={active.link}
            className={cn(
              "size-8",
              active.link ? "bg-selected text-signal" : "text-ink-2",
            )}
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
            onKeyDown={(event) => event.key === "Enter" && apply()}
          />
          {urlError ? (
            <p role="alert" className="text-xs text-danger-text">
              {urlError}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button size="sm" onClick={apply}>
              Add link
            </Button>
            {active.link ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => editor.chain().focus().unsetLink().run()}
              >
                Remove
              </Button>
            ) : null}
          </div>
        </PopoverContent>
      </Popover>

      {onMention ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Mention task, member or doc"
          title="Mention (@)"
          onClick={onMention}
          className="size-8 text-ink-2 hover:text-signal"
        >
          <AtSignIcon className="size-4" />
        </Button>
      ) : null}

      {onConvertToTask ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Compile to task"
          title="Compile selection to task"
          onClick={onConvertToTask}
          className="size-8 text-ink-2 hover:text-signal"
        >
          <SparklesIcon className="size-4" />
        </Button>
      ) : null}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="ml-auto text-ink-2">
            <MoreHorizontalIcon className="size-4" />
            More
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel>Headings</DropdownMenuLabel>
          {headingOptions.slice(0, 3).map((option) => (
            <DropdownMenuItem
              key={option.label}
              className="gap-2"
              onClick={() => onHeading(option.level)}
            >
              <option.icon className="size-4" />
              {option.label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem className="gap-2" onClick={() => onAction("quote")}>
            <QuoteIcon className="size-4" />
            Quote
          </DropdownMenuItem>
          <DropdownMenuItem
            className="gap-2"
            onClick={() => onAction("code-block")}
          >
            <Code2Icon className="size-4" />
            Code block
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2" onClick={() => onAction("table")}>
            <TableIcon className="size-4" />
            Table
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
