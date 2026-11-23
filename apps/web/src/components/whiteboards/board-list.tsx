"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";

import { useTrpcClient } from "@zentro/api/react";
import type { AppRouter } from "@zentro/api/server";
import type { inferRouterOutputs } from "@trpc/server";
import { EmptyState } from "@zentro/ui/components/empty-state";
import { PageHeader } from "@zentro/ui/components/page-header";
import { Button } from "@zentro/ui/shadcn/button";
import { Input } from "@zentro/ui/shadcn/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@zentro/ui/shadcn/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@zentro/ui/shadcn/alert-dialog";
import { toast, toastError } from "@zentro/ui/index";

type Board = inferRouterOutputs<AppRouter>["whiteboard"]["list"][number];
type Trashed = inferRouterOutputs<AppRouter>["whiteboard"]["trash"][number];

const dateFormat = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const message = (error: unknown) =>
  error instanceof Error ? error.message : undefined;

export function BoardList() {
  const trpc = useTrpcClient();
  const router = useRouter();
  const [boards, setBoards] = useState<Board[] | null>(null);
  const [trash, setTrash] = useState<Trashed[]>([]);
  const [failed, setFailed] = useState(false);
  const [naming, setNaming] = useState<{
    board: Board | null;
    title: string;
  } | null>(null);
  const [deleting, setDeleting] = useState<Board | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const [live, trashed] = await Promise.all([
        trpc.whiteboard.list.query(),
        trpc.whiteboard.trash.query(),
      ]);

      setBoards(live);
      setTrash(trashed);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [trpc]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveName() {
    if (!naming || creating) return;
    const { board } = naming;
    const title = naming.title.trim();
    if (!title) return;

    setCreating(true);
    try {
      if (board) {
        if (title !== board.title) {
          await trpc.whiteboard.rename.mutate({ id: board.id, title });
          await load();
        }
      } else {
        const { id } = await trpc.whiteboard.create.mutate({ title });
        router.push(`/whiteboards/${id}`);
      }
      setNaming(null);
    } catch (error) {
      toastError(
        board ? "Could not rename the board" : "Could not create the board",
        message(error),
      );
    } finally {
      setCreating(false);
    }
  }

  async function remove(board: Board) {
    try {
      await trpc.whiteboard.remove.mutate({ id: board.id });
      toast.success("Board moved to the trash");
      await load();
    } catch (error) {
      toastError("Could not delete the board", message(error));
    }
  }

  async function restore(board: Trashed) {
    try {
      await trpc.whiteboard.restore.mutate({ id: board.id });
      toast.success(`“${board.title}” restored`);
      await load();
    } catch (error) {
      toastError("Could not restore the board", message(error));
    }
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-6 overflow-y-auto p-6">
      <PageHeader
        title="Whiteboards"
        description="Sketch, diagram and plan together on an open canvas."
        actions={
          <Button
            disabled={creating}
            onClick={() => setNaming({ board: null, title: "Untitled board" })}
          >
            <PlusIcon aria-hidden />
            New board
          </Button>
        }
      />

      {failed ? (
        <EmptyState
          title="Boards did not load"
          description="Check your connection and try again."
          action={<Button onClick={() => void load()}>Retry</Button>}
        />
      ) : boards === null ? (
        <p role="status" className="text-sm text-ink-2">
          Loading boards…
        </p>
      ) : boards.length === 0 ? (
        <EmptyState
          title="No boards yet"
          description="Start a board to sketch an idea with your team."
          action={
            <Button
              onClick={() =>
                setNaming({ board: null, title: "Untitled board" })
              }
            >
              <PlusIcon aria-hidden />
              New board
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {boards.map((board) => (
            <li
              key={board.id}
              className="flex min-w-0 flex-col gap-3 rounded-xl border border-line p-4"
            >
              <Link
                href={`/whiteboards/${board.id}`}
                className="flex min-w-0 flex-col gap-1 hover:underline"
              >
                {/* Two lines, then an ellipsis: a long title stays readable. */}
                <span className="line-clamp-2 font-medium break-words text-ink">
                  {board.title}
                </span>
                <span className="text-xs text-ink-3">
                  {board.createdBy ?? "Someone"} · edited{" "}
                  {dateFormat.format(new Date(board.updatedAt))}
                </span>
              </Link>
              {board.canManage ? (
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Rename ${board.title}`}
                    onClick={() => setNaming({ board, title: board.title })}
                  >
                    <PencilIcon aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Delete ${board.title}`}
                    onClick={() => setDeleting(board)}
                  >
                    <Trash2Icon aria-hidden />
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {trash.length ? (
        <section aria-labelledby="board-trash" className="flex flex-col gap-2">
          <h2 id="board-trash" className="text-sm font-medium text-ink-2">
            Trash
          </h2>
          <ul className="flex flex-col divide-y divide-hairline rounded-xl border border-hairline">
            {trash.map((board) => (
              <li key={board.id} className="flex items-center gap-3 px-4 py-2">
                <span className="min-w-0 flex-1 truncate text-sm text-ink-2">
                  {board.title}
                </span>
                <span className="text-xs text-ink-3">
                  deleted {dateFormat.format(new Date(board.deletedAt))}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  aria-label={`Restore ${board.title}`}
                  onClick={() => void restore(board)}
                >
                  Restore
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <Dialog
        open={naming !== null}
        onOpenChange={(open) => {
          if (!open && !creating) setNaming(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {naming?.board ? "Rename board" : "New board"}
            </DialogTitle>
            <DialogDescription>
              Give the board a name your team can recognize.
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void saveName();
            }}
          >
            <Input
              autoFocus
              aria-label="Board name"
              value={naming?.title ?? ""}
              onChange={(event) => {
                if (naming) setNaming({ ...naming, title: event.target.value });
              }}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={creating}
                onClick={() => setNaming(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                loading={creating}
                disabled={!naming?.title.trim()}
              >
                {naming?.board ? "Save name" : "Create board"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Move “{deleting?.title}” to the trash?
            </AlertDialogTitle>
            <AlertDialogDescription>
              You can restore the board from the trash.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleting) void remove(deleting);
              }}
            >
              Move to trash
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
