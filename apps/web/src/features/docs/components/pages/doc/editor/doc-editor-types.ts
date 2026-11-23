import type { KeyboardEvent } from "react";
import type { Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Link as TiptapLink } from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import type { DocDetail } from "../../../../lib/docs";
import type { MentionItem } from "../mention-popover";
import type { SlashAction } from "./doc-toolbar-constants";

export type UseDocEditorReturn = {
  doc: DocDetail | null;
  setDoc: React.Dispatch<React.SetStateAction<DocDetail | null>>;
  title: string;
  setTitle: React.Dispatch<React.SetStateAction<string>>;
  content: string;
  setContent: React.Dispatch<React.SetStateAction<string>>;
  saveStatus: "saved" | "saving" | "error" | "conflict";
  isLoading: boolean;
  canEdit: boolean;
  canTrash: boolean;
  canComment: boolean;
  canCreateTask: boolean;
  isDeleting: boolean;
  editor: Editor | null;
  saveTitle: () => Promise<void>;
  deleteDoc: () => Promise<void>;
  runEditorAction: (action: SlashAction, removeSlash?: boolean) => void;
  setHeading: (level: 1 | 2 | 3 | 4 | 5 | 6) => void;
  handleSelectMention: (item: MentionItem) => void;
  handleEditorKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  handleCompileSelectionToTask: (prefill?: string) => void;
  showSlashMenu: boolean;
  setShowSlashMenu: React.Dispatch<React.SetStateAction<boolean>>;
  showMentionMenu: boolean;
  setShowMentionMenu: React.Dispatch<React.SetStateAction<boolean>>;
  createTaskOpen: boolean;
  setCreateTaskOpen: React.Dispatch<React.SetStateAction<boolean>>;
  prefillTaskName: string;
  setPrefillTaskName: React.Dispatch<React.SetStateAction<string>>;
  linksVersion: number;
  setLinksVersion: React.Dispatch<React.SetStateAction<number>>;
  owner: string;
};

export function createDocEditorExtensions() {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4, 5, 6] },
    }),
    TiptapLink.configure({
      openOnClick: false,
      HTMLAttributes: { class: "mention-link" },
    }),
    Placeholder.configure({
      placeholder: "Start typing, or press / for blocks, @ for mentions...",
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Table.configure({ resizable: true }),
    TableRow,
    TableHeader,
    TableCell,
  ];
}
