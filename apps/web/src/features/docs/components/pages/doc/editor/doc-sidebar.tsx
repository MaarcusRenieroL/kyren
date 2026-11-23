import { LinkedWork } from "~/src/components/links/linked-work";
import { LinkedThread } from "~/src/components/thread/linked-thread";
import { DiscussionPanel } from "~/src/components/chat/discussion-panel";
import { getDocTitle, type DocDetail } from "../../../../lib/docs";
import { CommentsPanel } from "../comments-panel";
import { LivingSpecPanel } from "../living-spec-panel";

export function DocSidebar({
  splitCanvas,
  doc,
  title,
  content,
  canEdit,
  canCreateTask,
  canComment,
  linksVersion,
  saveStatus,
  commentsOpen,
  setCommentsOpen,
  setCommentCount,
  handleCompileSelectionToTask,
  setLinksVersion,
}: {
  splitCanvas: boolean;
  doc: DocDetail;
  title: string;
  content: string;
  canEdit: boolean;
  canCreateTask: boolean;
  canComment: boolean;
  linksVersion: number;
  saveStatus: string;
  commentsOpen: boolean;
  setCommentsOpen: (open: boolean) => void;
  setCommentCount: (count: number | null) => void;
  handleCompileSelectionToTask: (prefill?: string) => void;
  setLinksVersion: React.Dispatch<React.SetStateAction<number>>;
}) {
  if (splitCanvas) {
    return (
      <div className="sticky top-16 max-h-[calc(100vh-5rem)] h-[calc(100vh-5rem)] self-start overflow-hidden">
        <LivingSpecPanel
          docId={doc.id}
          docTitle={getDocTitle(title)}
          docContent={content}
          projectId={doc.projectId}
          canEdit={canEdit}
          canCreateTask={canCreateTask}
          refreshTrigger={linksVersion}
          onOpenCreateTask={handleCompileSelectionToTask}
          onTaskChange={() => setLinksVersion((v) => v + 1)}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-6 pl-0 xl:sticky xl:top-16 xl:max-h-[calc(100vh-5rem)] xl:self-start xl:overflow-y-auto max-xl:contents">
      <LinkedWork
        source={{ type: "doc", id: doc.id }}
        selfId={doc.id}
        canEdit={canEdit}
        refreshKey={`${saveStatus}-${linksVersion}`}
      />

      <section aria-label="Thread" className="tile hidden p-4 xl:block">
        <LinkedThread
          header={(count) => (
            <div className="flex items-baseline justify-between pb-3">
              <h2 className="eyebrow">Thread</h2>
              <span className="font-mono text-xs text-ink-3">
                {count} linked
              </span>
            </div>
          )}
          current={{ kind: "doc", label: getDocTitle(title) }}
          currentId={doc.id}
          projectId={doc.projectId}
          projectName={doc.projectName}
          discussion={{ type: "doc", id: doc.id }}
        />
      </section>

      <DiscussionPanel type="doc" id={doc.id} />

      <CommentsPanel
        docId={doc.id}
        canComment={canComment}
        isOpen={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        onCount={setCommentCount}
      />
    </div>
  );
}
