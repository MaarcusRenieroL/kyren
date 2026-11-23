"use client";

import { useEffect, useState } from "react";
import { useTrpcClient } from "@kyren/api/react";
import { Skeleton } from "@kyren/ui/shadcn/skeleton";
import { DocTable } from "~/src/features/docs/components/doc-rows";
import type { DocsListItem } from "~/src/features/docs/lib/docs";

export function ProjectDocsList({ projectId }: { projectId: string }) {
  const trpc = useTrpcClient();
  const [docs, setDocs] = useState<DocsListItem[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let isMounted = true;

    trpc.docs.getAll
      .query({})
      .then((data) => {
        if (isMounted) {
          setDocs(data.filter((doc) => doc.projectId === projectId));
        }
      })
      .catch(() => isMounted && setFailed(true));

    return () => {
      isMounted = false;
    };
  }, [projectId, trpc]);

  if (failed) {
    return (
      <p className="text-sm text-ink-2">
        Docs could not be loaded. They are safe; reload to try again.
      </p>
    );
  }

  if (!docs) return <Skeleton className="h-40 rounded-xl" />;

  if (!docs.length) {
    return (
      <p className="text-sm text-ink-2">No docs linked to this project.</p>
    );
  }

  return <DocTable docs={docs} />;
}
