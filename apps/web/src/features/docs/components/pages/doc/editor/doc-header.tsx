import Link from "next/link";
import {
  CheckIcon,
  ChevronLeftIcon,
  Columns2Icon,
  HistoryIcon,
  MessageSquareIcon,
  MoreHorizontalIcon,
  SquareCheckIcon,
  Trash2Icon,
} from "lucide-react";
import { paths } from "~/src/lib/paths";
import { Button } from "@zentro/ui/shadcn/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@zentro/ui/shadcn/dropdown-menu";
import { cn } from "@zentro/ui/lib/utils";
import { StarButton } from "~/src/components/favorites/star-button";
import { getDocTitle, type DocDetail } from "../../../../lib/docs";
import { ShareDialog } from "../share-dialog";

export function DocHeader({
  doc,
  title,
  saveStatus,
  splitCanvas,
  setSplitCanvas,
  historyOpen,
  setHistoryOpen,
  commentsOpen,
  setCommentsOpen,
  commentCount,
  shareOpen,
  setShareOpen,
  canCreateTask,
  handleCompileSelectionToTask,
  canTrash,
  isDeleting,
  deleteDoc,
}: {
  doc: DocDetail;
  title: string;
  saveStatus: "saved" | "saving" | "error" | "conflict";
  splitCanvas: boolean;
  setSplitCanvas: React.Dispatch<React.SetStateAction<boolean>>;
  historyOpen: boolean;
  setHistoryOpen: React.Dispatch<React.SetStateAction<boolean>>;
  commentsOpen: boolean;
  setCommentsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  commentCount: number | null;
  shareOpen: boolean;
  setShareOpen: (open: boolean) => void;
  canCreateTask: boolean;
  handleCompileSelectionToTask: () => void;
  canTrash: boolean;
  isDeleting: boolean;
  deleteDoc: () => Promise<void>;
}) {
  return (
    <div className="sticky top-0 z-20 border-b border-hairline bg-canvas/90 backdrop-blur">
      <div className="flex min-h-12 items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-1.5 text-[13px] text-ink-2">
          <Link
            href={paths.docs()}
            className="flex items-center gap-1 rounded-xs outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronLeftIcon className="size-3.5" aria-hidden="true" />
            Docs
          </Link>
          {doc.projectName ? (
            <span className="hidden truncate text-ink-3 sm:inline">
              / {doc.projectName}
            </span>
          ) : null}
          <span
            role="status"
            className="ml-2 flex items-center gap-1.5 font-mono text-xs whitespace-nowrap text-ink-3"
            suppressHydrationWarning
          >
            {saveStatus === "conflict" ? (
              <>
                <span
                  aria-hidden="true"
                  className="size-2 rounded-full bg-danger"
                />
                Changed elsewhere. Reload to see it.
              </>
            ) : saveStatus === "error" ? (
              <>
                <span
                  aria-hidden="true"
                  className="size-2 rounded-full bg-danger"
                />
                Not saved. Retrying…
              </>
            ) : saveStatus === "saving" ? (
              <>
                <span
                  aria-hidden="true"
                  className="size-2 animate-pulse rounded-full bg-status-progress"
                />
                Saving…
              </>
            ) : (
              <>
                <span
                  aria-hidden="true"
                  className="flex size-3.5 items-center justify-center rounded-full bg-success text-on-success"
                >
                  <CheckIcon className="size-2.5" strokeWidth={3} />
                </span>
                <span className="sr-only sm:not-sr-only">
                  Saved{" "}
                  {new Date(doc.updatedAt).toLocaleTimeString("en-GB", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </>
            )}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <StarButton
            type="doc"
            id={doc.id}
            title={getDocTitle(title)}
            href={`/docs/${doc.slug}`}
          />
          <Button
            variant={splitCanvas ? "secondary" : "outline"}
            size="sm"
            aria-pressed={splitCanvas}
            aria-label="Split canvas"
            className={cn(
              "h-8 gap-1.5 border-hairline px-2.5 text-[13px]",
              splitCanvas
                ? "border-signal bg-signal/10 text-signal font-medium"
                : "bg-transparent",
            )}
            onClick={() => setSplitCanvas((v) => !v)}
            title="Toggle Split Canvas: Spec & Tasks side-by-side"
          >
            <Columns2Icon className="size-3.5" />
            <span className="hidden sm:inline">Split Canvas</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            aria-pressed={historyOpen}
            aria-label={
              historyOpen ? "Hide version history" : "Show version history"
            }
            className={cn(
              "h-8 gap-1.5 border-hairline px-2.5 text-[13px]",
              historyOpen ? "border-ink bg-hover" : "bg-transparent",
            )}
            onClick={() => setHistoryOpen((isOpen) => !isOpen)}
            title="Version history snapshots & rollback"
          >
            <HistoryIcon className="size-3.5 text-signal" />
            <span className="hidden sm:inline">History</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            aria-pressed={commentsOpen}
            aria-label={commentsOpen ? "Hide comments" : "Show comments"}
            className={cn(
              "h-8 gap-1.5 border-hairline px-2.5 text-[13px]",
              commentsOpen ? "border-ink bg-hover" : "bg-transparent",
            )}
            onClick={() => setCommentsOpen((isOpen) => !isOpen)}
          >
            <MessageSquareIcon className="size-4" />
            {commentCount ?? ""}
          </Button>
          <Button
            size="sm"
            className="h-8 px-3 text-[13px] font-semibold"
            onClick={() => setShareOpen(true)}
          >
            Share
          </Button>
          <ShareDialog
            docId={doc.id}
            open={shareOpen}
            onOpenChange={setShareOpen}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="size-8">
                <MoreHorizontalIcon className="size-4" />
                <span className="sr-only">Page actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem
                className="gap-2"
                onClick={() => setCommentsOpen((isOpen) => !isOpen)}
              >
                <MessageSquareIcon className="size-4" />
                {commentsOpen ? "Hide comments" : "Show comments"}
              </DropdownMenuItem>
              {canCreateTask ? (
                <DropdownMenuItem
                  className="gap-2"
                  onClick={handleCompileSelectionToTask}
                >
                  <SquareCheckIcon className="size-4" />
                  Create task from this doc
                </DropdownMenuItem>
              ) : null}
              {canTrash ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="gap-2 text-destructive focus:text-destructive"
                    disabled={isDeleting}
                    onClick={() => void deleteDoc()}
                  >
                    <Trash2Icon className="size-4" />
                    {isDeleting ? "Moving..." : "Move to trash"}
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
