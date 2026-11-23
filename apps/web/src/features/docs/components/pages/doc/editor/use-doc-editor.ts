import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { useEditor, type Editor } from "@tiptap/react";
import { useTrpcClient } from "@zentro/api/react";
import { toastError, toastSuccess } from "@zentro/ui/index";
import { paths } from "~/src/lib/paths";
import {
  useAnyPermission,
  useReachable,
} from "~/src/components/permissions/permission-provider";
import { usePageCrumb } from "~/src/components/shell/breadcrumb-context";
import {
  getDocOwner,
  getDocTitle,
  type DocDetail,
} from "../../../../lib/docs";
import type { MentionItem } from "../mention-popover";
import {
  escapeHtml,
  htmlToMarkdown,
  markdownToHtml,
} from "./doc-markdown";
import type { SlashAction } from "./doc-toolbar-constants";
import {
  createDocEditorExtensions,
  type UseDocEditorReturn,
} from "./doc-editor-types";

export type { UseDocEditorReturn };

export function useDocEditor({ slug }: { slug: string }): UseDocEditorReturn {
  const router = useRouter();
  const trpc = useTrpcClient();
  const [doc, setDoc] = useState<DocDetail | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error" | "conflict">("saved");
  const [isLoading, setIsLoading] = useState(true);
  const [retryTick, setRetryTick] = useState(0);
  const contentSaveInFlight = useRef(false);

  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [prefillTaskName, setPrefillTaskName] = useState("");
  const [linksVersion, setLinksVersion] = useState(0);
  const canCreateTask = useReachable("tasks.create");
  const [isDeleting, setIsDeleting] = useState(false);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [showMentionMenu, setShowMentionMenu] = useState(false);

  const loadedEditorDocIdRef = useRef<string | null>(null);

  const editorExtensions = useMemo(() => createDocEditorExtensions(), []);

  const editor = useEditor({
    extensions: editorExtensions,
    content: "",
    immediatelyRender: false,
    editable: false,
    editorProps: {
      attributes: {
        class: "docs-editor-content",
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": "Doc body",
      },
    },
    onUpdate({ editor }) {
      setContent(htmlToMarkdown(editor.getHTML()));
    },
  });

  usePageCrumb(`/docs/${slug}`, doc ? getDocTitle(doc.title) : null);

  const docResource = {
    projectId: doc?.projectId ?? undefined,
    teamId: doc?.teamId ?? undefined,
    ownerUserId: doc?.createdByUserId ?? null,
  };
  const canEdit = useAnyPermission(["docs.update_any", "docs.update_own"], docResource);
  const canTrash = useAnyPermission(["docs.trash_any", "docs.trash_own"], docResource);
  const canComment = useAnyPermission(["docs.comment"], docResource);

  useEffect(() => {
    if (!editor) return;
    const editable = Boolean(doc) && canEdit;
    editor.setEditable(editable, false);
    editor.view.dom.setAttribute("aria-readonly", String(!editable));
  }, [editor, canEdit, doc?.id]);

  useEffect(() => {
    let isMounted = true;
    async function fetchDoc() {
      try {
        const docData = await trpc.docs.getBySlug.query({ slug });
        if (isMounted) {
          setDoc(docData);
          setTitle(getDocTitle(docData.title));
          setContent(docData.content);
        }
      } catch (error) {
        toastError(error, "Failed to load doc");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    void fetchDoc();
    return () => {
      isMounted = false;
    };
  }, [slug, trpc]);

  useEffect(() => {
    if (!editor || !doc) return;
    if (loadedEditorDocIdRef.current === doc.id) return;
    editor.commands.setContent(markdownToHtml(doc.content));
    loadedEditorDocIdRef.current = doc.id;
  }, [doc, editor]);

  useEffect(() => {
    if (!doc || content === doc.content) return;
    setSaveStatus("saving");

    const timeout = window.setTimeout(async () => {
      if (contentSaveInFlight.current) return;
      contentSaveInFlight.current = true;

      try {
        const updatedDoc = await trpc.docs.updateDocContent.mutate({
          id: doc.id,
          content,
          expectedUpdatedAt: doc.updatedAt,
        });

        setDoc((currentDoc) =>
          currentDoc
            ? { ...currentDoc, content: updatedDoc.content, updatedAt: updatedDoc.updatedAt }
            : currentDoc,
        );
        setSaveStatus("saved");
      } catch (error) {
        toastError(error, "Failed to save doc content");
        const code = (error as { data?: { code?: string } }).data?.code;
        setSaveStatus(code === "CONFLICT" ? "conflict" : "error");
      } finally {
        contentSaveInFlight.current = false;
      }
    }, 700);

    return () => window.clearTimeout(timeout);
  }, [content, doc, trpc, retryTick]);

  useEffect(() => {
    if (saveStatus !== "error") return;
    const retry = window.setTimeout(() => setRetryTick((tick) => tick + 1), 5000);
    return () => window.clearTimeout(retry);
  }, [saveStatus]);

  async function saveTitle() {
    if (!doc || title.trim() === doc.title) return;
    try {
      setSaveStatus("saving");
      const updatedDoc = await trpc.docs.updateDocTitle.mutate({
        id: doc.id,
        title: title.trim() || "Untitled",
      });
      setDoc((currentDoc) =>
        currentDoc
          ? { ...currentDoc, title: updatedDoc.title, updatedAt: updatedDoc.updatedAt }
          : currentDoc,
      );
      setSaveStatus("saved");
    } catch (error) {
      toastError(error, "Failed to save doc title");
      setSaveStatus("error");
    }
  }

  async function deleteDoc() {
    if (!doc || isDeleting) return;
    try {
      setIsDeleting(true);
      await trpc.docs.delete.mutate({ id: doc.id });
      toastSuccess("Doc moved to trash");
      router.push(paths.docs());
    } catch (error) {
      toastError(error, "Failed to delete doc");
      setIsDeleting(false);
    }
  }

  function removeTypedSlash(currentEditor: Editor) {
    const position = currentEditor.state.selection.from;
    const previousChar = currentEditor.state.doc.textBetween(Math.max(0, position - 1), position);
    if (previousChar === "/") {
      currentEditor.chain().focus().deleteRange({ from: position - 1, to: position }).run();
    }
  }

  function runEditorAction(action: SlashAction, removeSlash = false) {
    if (!editor) return;
    if (removeSlash) removeTypedSlash(editor);
    const chain = editor.chain().focus();

    if (action === "heading-1") chain.toggleHeading({ level: 1 }).run();
    else if (action === "heading-2") chain.toggleHeading({ level: 2 }).run();
    else if (action === "heading-3") chain.toggleHeading({ level: 3 }).run();
    else if (action === "bullet-list") chain.toggleBulletList().run();
    else if (action === "task-list") chain.toggleTaskList().run();
    else if (action === "quote") chain.toggleBlockquote().run();
    else if (action === "code-block") chain.toggleCodeBlock().run();
    else if (action === "inline-code") chain.toggleCode().run();
    else if (action === "table") chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    else if (action === "mention") setShowMentionMenu(true);

    setShowSlashMenu(false);
  }

  function setHeading(level: 1 | 2 | 3 | 4 | 5 | 6) {
    editor?.chain().focus().toggleHeading({ level }).run();
  }

  function removeTypedAt(currentEditor: Editor) {
    const position = currentEditor.state.selection.from;
    const previousChar = currentEditor.state.doc.textBetween(Math.max(0, position - 1), position);
    if (previousChar === "@") {
      currentEditor.chain().focus().deleteRange({ from: position - 1, to: position }).run();
    }
  }

  function handleSelectMention(item: MentionItem) {
    if (!editor) return;
    removeTypedAt(editor);
    editor.chain().focus().insertContent(`<a href="${item.link}" class="mention-link">@${escapeHtml(item.title)}</a> `).run();
    setShowMentionMenu(false);
  }

  function handleEditorKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "/") setShowSlashMenu(true);
    if (event.key === "@") setShowMentionMenu(true);
    if (event.key === "Escape") {
      setShowSlashMenu(false);
      setShowMentionMenu(false);
    }
  }

  const handleCompileSelectionToTask = (prefill?: string) => {
    if (typeof prefill === "string" && prefill.trim().length > 0) {
      setPrefillTaskName(prefill.trim());
      setCreateTaskOpen(true);
      return;
    }
    if (editor) {
      const selected = editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, " ").trim();
      setPrefillTaskName(selected || "");
    } else {
      setPrefillTaskName("");
    }
    setCreateTaskOpen(true);
  };

  const owner = doc ? getDocOwner(doc) : "";

  return {
    doc,
    setDoc,
    title,
    setTitle,
    content,
    setContent,
    saveStatus,
    isLoading,
    canEdit,
    canTrash,
    canComment,
    canCreateTask,
    isDeleting,
    editor,
    saveTitle,
    deleteDoc,
    runEditorAction,
    setHeading,
    handleSelectMention,
    handleEditorKeyDown,
    handleCompileSelectionToTask,
    showSlashMenu,
    setShowSlashMenu,
    showMentionMenu,
    setShowMentionMenu,
    createTaskOpen,
    setCreateTaskOpen,
    prefillTaskName,
    setPrefillTaskName,
    linksVersion,
    setLinksVersion,
    owner,
  };
}
