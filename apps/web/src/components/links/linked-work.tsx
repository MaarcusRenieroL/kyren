"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FileTextIcon } from "lucide-react";
import { useTrpcClient } from "@kyren/api/react";
import { toastError, toastSuccess } from "@kyren/ui/index";
import { Button } from "@kyren/ui/shadcn/button";
import { Skeleton } from "@kyren/ui/shadcn/skeleton";
import { useReachable } from "~/src/components/permissions/permission-provider";
import { trpcResult } from "~/src/lib/trpc-result";
import type { Candidate, Item, Source } from "./linked-work/types";
import { LinkPickerPopover } from "./linked-work/link-picker-popover";
import { LinkedGroups } from "./linked-work/linked-item-row";

export type { Relation, Item, Candidate, Source } from "./linked-work/types";

/**
 * The work this task or doc is connected to: what blocks it, what it blocks,
 * related tasks and docs, and where its key is mentioned. Editors can add
 * and remove links; mentions follow the text that makes them.
 */
export function LinkedWork({
  source,
  canEdit,
  refreshKey,
  selfId,
  newDoc,
}: {
  source: Source;
  canEdit: boolean;
  /** Changes when the source's text is saved, so mentions reload. */
  refreshKey?: string;
  /** Left out of the picker. */
  selfId: string;
  /** For a task: write a new doc linked to it, in this project. */
  newDoc?: { projectId: string | null; title: string };
}) {
  const trpc = useTrpcClient();
  const router = useRouter();
  const canCreateDoc = useReachable("docs.create");
  const [writing, setWriting] = useState(false);
  const [items, setItems] = useState<Item[] | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"relates" | "blocks" | "blocked_by">(
    "relates",
  );
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const sourceKey = JSON.stringify(source);

  const load = useCallback(async () => {
    const parsed = JSON.parse(sourceKey) as Source;
    const { data } = await trpcResult(
      parsed.type === "task"
        ? trpc.link.forTask.query({ taskKey: parsed.key })
        : trpc.link.forDoc.query({ docId: parsed.id }),
    );

    setItems((data ?? []) as Item[]);
  }, [trpc, sourceKey]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  // The picker loads tasks and docs the first time it opens.
  useEffect(() => {
    if (!open || candidates) return;

    void Promise.all([
      trpc.task.getTasksByOrgId.query({}).catch(() => []),
      trpc.docs.getAll.query({}).catch(() => []),
    ]).then(([tasks, docs]) =>
      setCandidates(
        [
          ...tasks.map((task) => ({
            type: "task" as const,
            ref: task.key,
            title: task.name,
            key: task.key,
            status: task.status,
            id: task.id,
          })),
          ...docs.map((doc) => ({
            type: "doc" as const,
            ref: doc.id,
            title: doc.title || "Untitled",
            key: null,
            status: null,
            id: doc.id,
          })),
        ].filter((candidate) => candidate.id !== selfId),
      ),
    );
  }, [open, candidates, trpc, selfId]);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const linked = new Set(items?.map((item) => `${item.type}:${item.id}`));

    return (candidates ?? [])
      .filter(
        (candidate) =>
          (kind === "relates" || candidate.type === "task") &&
          !linked.has(`${candidate.type}:${candidate.id}`) &&
          (!needle ||
            candidate.title.toLowerCase().includes(needle) ||
            candidate.key?.toLowerCase().includes(needle)),
      )
      .slice(0, 8);
  }, [candidates, query, kind, items]);

  const add = async (candidate: Candidate) => {
    const target =
      candidate.type === "task"
        ? { type: "task" as const, key: candidate.ref }
        : { type: "doc" as const, id: candidate.ref };
    const { error } = await trpcResult(
      source.type === "task"
        ? trpc.link.addFromTask.mutate({
            taskKey: source.key,
            target,
            kind,
          })
        : trpc.link.addFromDoc.mutate({ docId: source.id, target }),
    );

    if (error) {
      toastError(error.statusText, error.message);
      return;
    }

    toastSuccess("Linked", candidate.key ?? candidate.title);
    setOpen(false);
    setQuery("");
    await load();
  };

  const writeDoc = async () => {
    if (!newDoc || source.type !== "task") return;

    setWriting(true);

    const slug = `${newDoc.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60)}-${Math.random().toString(36).slice(2, 6)}`;
    const { data, error } = await trpcResult(
      trpc.docs.create.mutate({
        title: newDoc.title,
        slug,
        projectId: newDoc.projectId,
        linkTaskKey: source.key,
      }),
    );

    setWriting(false);

    if (error) {
      toastError(error.statusText, error.message);
      return;
    }

    router.push(`/docs/${data.slug}`);
  };

  const remove = async (item: Item) => {
    const { error } = await trpcResult(
      trpc.link.remove.mutate({ linkId: item.linkId }),
    );

    if (error) {
      toastError(error.statusText, error.message);
      return;
    }

    await load();
  };

  return (
    <section aria-label="Linked work" className="tile flex flex-col gap-2 p-4">
      <div className="flex items-center justify-between">
        <h2 className="eyebrow">Linked work</h2>
        {canEdit ? (
          <LinkPickerPopover
            open={open}
            setOpen={setOpen}
            source={source}
            kind={kind}
            setKind={setKind}
            query={query}
            setQuery={setQuery}
            candidates={candidates}
            shown={shown}
            onAdd={add}
          />
        ) : null}
      </div>

      {items === null ? (
        <Skeleton className="h-10 w-full" />
      ) : items.length === 0 ? (
        <p className="text-[13px] leading-5 text-ink-3">
          {source.type === "task"
            ? "Nothing linked yet. Link what blocks this task, or the doc that specs it. Naming a key like ZEN-12 in text links it too."
            : "Nothing linked yet. Link the tasks this doc is about, or name their keys in the text."}
        </p>
      ) : (
        <LinkedGroups items={items} canEdit={canEdit} onRemove={remove} />
      )}
      {newDoc && canCreateDoc && source.type === "task" ? (
        <Button
          variant="outline"
          size="sm"
          className="mt-1 self-start"
          loading={writing}
          onClick={() => void writeDoc()}
        >
          <FileTextIcon />
          Write a doc for this task
        </Button>
      ) : null}
    </section>
  );
}
