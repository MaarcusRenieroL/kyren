import {
  AtSignIcon,
  CheckSquareIcon,
  Code2Icon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  Heading4Icon,
  Heading5Icon,
  Heading6Icon,
  ListIcon,
  QuoteIcon,
  TableIcon,
} from "lucide-react";
import type { Editor } from "@tiptap/react";

export const slashCommands = [
  {
    label: "Heading 1",
    hint: "#",
    description: "Big section heading",
    icon: Heading1Icon,
    action: "heading-1",
  },
  {
    label: "Heading 2",
    hint: "##",
    description: "Section heading",
    icon: Heading2Icon,
    action: "heading-2",
  },
  {
    label: "Heading 3",
    hint: "###",
    description: "Nested section heading",
    icon: Heading3Icon,
    action: "heading-3",
  },
  {
    label: "Bullet list",
    hint: "-",
    description: "Create a simple list",
    icon: ListIcon,
    action: "bullet-list",
  },
  {
    label: "Checklist",
    hint: "[ ]",
    description: "Track an action item",
    icon: CheckSquareIcon,
    action: "task-list",
  },
  {
    label: "Quote",
    hint: ">",
    description: "Highlight a decision",
    icon: QuoteIcon,
    action: "quote",
  },
  {
    label: "Code block",
    hint: "```",
    description: "Add a code block",
    icon: Code2Icon,
    action: "code-block",
  },
  {
    label: "Inline code",
    hint: "`",
    description: "Add a short code phrase",
    icon: Code2Icon,
    action: "inline-code",
  },
  {
    label: "Table",
    hint: "",
    description: "Insert a 3 by 3 markdown table",
    icon: TableIcon,
    action: "table",
  },
  {
    label: "Mention",
    hint: "@",
    description: "Mention a task, teammate, or document",
    icon: AtSignIcon,
    action: "mention",
  },
] as const;

export type SlashAction = (typeof slashCommands)[number]["action"];

export const headingOptions = [
  { label: "H1", icon: Heading1Icon, level: 1 as const },
  { label: "H2", icon: Heading2Icon, level: 2 as const },
  { label: "H3", icon: Heading3Icon, level: 3 as const },
  { label: "H4", icon: Heading4Icon, level: 4 as const },
  { label: "H5", icon: Heading5Icon, level: 5 as const },
  { label: "H6", icon: Heading6Icon, level: 6 as const },
];

export type ToolbarProps = {
  editor: Editor | null;
  canEdit: boolean;
  onAction: (action: SlashAction) => void;
  onHeading: (level: 1 | 2 | 3 | 4 | 5 | 6) => void;
  onConvertToTask?: () => void;
  onMention?: () => void;
};
