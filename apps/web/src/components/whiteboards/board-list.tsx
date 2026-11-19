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

  async function create() {
    const title = window.prompt("Name the board", "Untitled board")?.trim();

    if (!title) return;

    setCreating(true);
    try {
      const { id } = await trpc.whiteboard.create.mutate({ title });
      router.push(`/whiteboards/${id}`);
    } catch (error) {
      toastError("Could not create the board", message(error));
      setCreating(false);
    }
  }

  async function rename(board: Board) {
    const title = window.prompt("Rename the board", board.title)?.trim();

    if (!title || title === board.title) return;

    try {
      await trpc.whiteboard.rename.mutate({ id: board.id, title });
      await load();
    } catch (error) {
      toastError("Could not rename the board", message(error));
    }
  }

  async function remove(board: Board) {
    if (
      !window.confirm(
        `Move “${board.title}” to the trash? You can restore it from there.`,
      )
    )
      return;

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
          <Button disabled={creating} onClick={() => void create()}>
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
            <Button onClick={() => void create()}>
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
              className="flex flex-col gap-3 rounded-xl border border-line p-4"
            >
              <Link
                href={`/whiteboards/${board.id}`}
                className="flex flex-col gap-1 hover:underline"
              >
                <span className="truncate font-medium text-ink">
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
                    onClick={() => void rename(board)}
                  >
                    <PencilIcon aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Delete ${board.title}`}
                    onClick={() => void remove(board)}
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
    </div>
  );
}
