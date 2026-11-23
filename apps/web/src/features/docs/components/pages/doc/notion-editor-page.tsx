"use client";

import { useState, useEffect } from "react";
import { EditorContent } from "@tiptap/react";
import { FileTextIcon, PlusIcon } from "lucide-react";
import { Button } from "@zentro/ui/shadcn/button";
import { Input } from "@zentro/ui/shadcn/input";
import { cn } from "@zentro/ui/lib/utils";
import { CreateTaskModal } from "~/src/features/tasks/components/create-task-modal";
import { ActivityFeed } from "~/src/components/workspace/activity/activity-feed";
import { ActorAvatar } from "~/src/components/actor-avatar";
import { formatDocDate, getDocProject } from "../../../lib/docs";
import { MentionPopover } from "./mention-popover";
import { VersionHistoryPanel } from "./version-history-panel";
import { docsEditorClassName, markdownToHtml } from "./editor/doc-markdown";
import { DocToolbar, slashCommands } from "./editor/doc-toolbar";
import { DocHeader } from "./editor/doc-header";
import { DocSidebar } from "./editor/doc-sidebar";
import { useDocEditor } from "./editor/use-doc-editor";

export function NotionEditorPage({ slug }: { slug: string }) {
  const [splitCanvas, setSplitCanvas] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentCount, setCommentCount] = useState<number | null>(null);

  useEffect(() => {
    setCommentsOpen(window.matchMedia("(min-width: 1280px)").matches);
  }, []);

  const d = useDocEditor({ slug });

  if (d.isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] border-t">
        <main className="min-w-0 flex-1 bg-background">
          <div className="mx-auto max-w-4xl px-6 py-8">
            <div className="mb-8 h-6 w-72 animate-pulse rounded-md bg-muted" />
            <div className="h-12 w-full max-w-2xl animate-pulse rounded-md bg-muted" />
            <div className="mt-10 h-80 animate-pulse rounded-md bg-muted" />
          </div>
        </main>
      </div>
    );
  }

  if (!d.doc) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center border-t px-6">
        <div className="max-w-md text-center">
          <FileTextIcon className="mx-auto mb-4 size-10 text-muted-foreground" />
          <h1 className="text-xl font-semibold">Doc not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This doc may have been deleted or moved to another workspace.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] border-t border-hairline bg-canvas">
      <DocHeader
        doc={d.doc}
        title={d.title}
        saveStatus={d.saveStatus}
        splitCanvas={splitCanvas}
        setSplitCanvas={setSplitCanvas}
        historyOpen={historyOpen}
        setHistoryOpen={setHistoryOpen}
        commentsOpen={commentsOpen}
        setCommentsOpen={setCommentsOpen}
        commentCount={commentCount}
        shareOpen={shareOpen}
        setShareOpen={setShareOpen}
        canCreateTask={d.canCreateTask}
        handleCompileSelectionToTask={() => d.handleCompileSelectionToTask()}
        canTrash={d.canTrash}
        isDeleting={d.isDeleting}
        deleteDoc={d.deleteDoc}
      />

      <div
        className={cn(
          "grid min-h-[calc(100vh-7rem)]",
          splitCanvas
            ? "grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(380px,1fr)] xl:grid-cols-[minmax(0,1.3fr)_minmax(420px,1fr)]"
            : "xl:grid-cols-[minmax(0,1fr)_22rem]",
        )}
      >
        <main
          className={cn(
            "min-w-0 bg-canvas",
            splitCanvas && "border-r border-hairline",
          )}
        >
          <div
            className={cn(
              "mx-auto w-full px-5 py-8 sm:px-8 lg:py-12",
              splitCanvas ? "max-w-3xl" : "max-w-[720px]",
            )}
          >
            <div>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="inline-flex h-[26px] items-center gap-1.5 rounded-sm border border-hairline pr-2 pl-1 text-xs text-ink-2">
                  <span className="flex size-4 items-center justify-center rounded-[5px] bg-tint-projects font-mono text-[8px] text-ink">
                    {getDocProject(d.doc).charAt(0).toUpperCase()}
                  </span>
                  {getDocProject(d.doc)}
                </span>
                <span className="inline-flex h-[26px] items-center gap-1.5 rounded-sm border border-hairline pr-2 pl-1 text-xs text-ink-2">
                  <ActorAvatar name={d.owner} size={18} />
                  {d.owner}
                </span>
                <span className="inline-flex h-[26px] items-center rounded-sm border border-hairline px-2 font-mono text-xs text-ink-3">
                  Edited {formatDocDate(d.doc.updatedAt)}
                </span>
              </div>

              <Input
                value={d.title}
                onChange={(event) => d.setTitle(event.target.value)}
                onBlur={d.saveTitle}
                readOnly={!d.canEdit}
                placeholder="Untitled"
                aria-label="Doc title"
                className="!h-auto border-none bg-transparent px-0 py-0 font-display !text-[2.25rem] !leading-10 shadow-none outline-none focus-visible:ring-0 sm:!text-[2.5rem] sm:!leading-[44px]"
              />
            </div>

            <div className="mt-9">
              <DocToolbar
                editor={d.editor}
                canEdit={d.canEdit}
                onAction={(action) => d.runEditorAction(action)}
                onHeading={d.setHeading}
                onConvertToTask={() => d.handleCompileSelectionToTask()}
                onMention={() => d.setShowMentionMenu(true)}
              />

              <div className="relative group">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="absolute top-1 -left-10 hidden opacity-0 group-hover:opacity-100 lg:inline-flex"
                  onClick={() => d.setShowSlashMenu((isOpen) => !isOpen)}
                >
                  <PlusIcon className="size-4" />
                  <span className="sr-only">Insert block</span>
                </Button>

                {d.editor ? (
                  <EditorContent
                    editor={d.editor}
                    onKeyDown={d.handleEditorKeyDown}
                    className={docsEditorClassName}
                  />
                ) : (
                  <div className="min-h-[620px] animate-pulse rounded-lg bg-muted/40" />
                )}

                {d.showMentionMenu && (
                  <MentionPopover
                    isOpen={d.showMentionMenu}
                    onClose={() => d.setShowMentionMenu(false)}
                    onSelect={d.handleSelectMention}
                  />
                )}

                {d.showSlashMenu && (
                  <div
                    role="menu"
                    aria-label="Insert block"
                    className="absolute top-9 left-0 z-10 w-[300px] overflow-hidden rounded-2xl border border-hairline bg-overlay p-1.5 shadow-xl"
                  >
                    <div className="eyebrow px-2.5 pt-2 pb-1 text-[10px]">
                      Basic
                    </div>
                    {slashCommands.map((command) => (
                      <Button
                        variant="custom"
                        key={command.label}
                        type="button"
                        role="menuitem"
                        onClick={() => d.runEditorAction(command.action, true)}
                        className="flex h-9 w-full items-center gap-3 rounded-[10px] px-2 text-left text-sm outline-none hover:bg-hover focus-visible:bg-hover"
                      >
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-sm border border-hairline text-ink-2">
                          <command.icon className="size-3.5" />
                        </span>
                        <span className="min-w-0 flex-1 truncate">
                          {command.label}
                        </span>
                        {command.hint ? (
                          <span className="font-mono text-[11px] text-ink-3">
                            {command.hint}
                          </span>
                        ) : null}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          <section
            className="mx-auto mt-10 w-full max-w-3xl px-4 pb-10"
            aria-label="Doc activity"
          >
            <h2 className="mb-3 text-sm font-semibold">Activity</h2>
            <ActivityFeed
              selector={{ targetType: "doc", targetId: d.doc.id }}
            />
          </section>
        </main>

        <DocSidebar
          splitCanvas={splitCanvas}
          doc={d.doc}
          title={d.title}
          content={d.content}
          canEdit={d.canEdit}
          canCreateTask={d.canCreateTask}
          canComment={d.canComment}
          linksVersion={d.linksVersion}
          saveStatus={d.saveStatus}
          commentsOpen={commentsOpen}
          setCommentsOpen={setCommentsOpen}
          setCommentCount={setCommentCount}
          handleCompileSelectionToTask={d.handleCompileSelectionToTask}
          setLinksVersion={d.setLinksVersion}
        />

        {d.canCreateTask ? (
          <CreateTaskModal
            hideTrigger
            open={d.createTaskOpen}
            onOpenChange={(isOpen) => {
              d.setCreateTaskOpen(isOpen);
              if (!isOpen) d.setPrefillTaskName("");
            }}
            defaultName={d.prefillTaskName}
            linkDocId={d.doc.id}
            defaultProjectId={d.doc.projectId ?? undefined}
            onTaskCreated={() => {
              d.setLinksVersion((value) => value + 1);
              d.setPrefillTaskName("");
            }}
          />
        ) : null}

        {historyOpen && d.doc ? (
          <VersionHistoryPanel
            docId={d.doc.id}
            isOpen={historyOpen}
            onClose={() => setHistoryOpen(false)}
            currentUpdatedAt={d.doc.updatedAt}
            onRestore={(restoredContent, updatedAt) => {
              d.setDoc((currentDoc) =>
                currentDoc
                  ? { ...currentDoc, content: restoredContent, updatedAt }
                  : currentDoc,
              );
              d.setContent(restoredContent);
              d.editor?.commands.setContent(markdownToHtml(restoredContent));
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
