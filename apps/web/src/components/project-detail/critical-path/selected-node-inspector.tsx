"use client";

import { Button } from "@zentro/ui/shadcn/button";
import type { FC } from "react";
import Link from "next/link";
import { ArrowRightIcon, CheckCircle2Icon, ClockIcon } from "lucide-react";
import { paths } from "~/src/lib/paths";
import type { Edge } from "./types";

type SelectedNodeInspectorProps = {
  selectedKey: string;
  relatedEdges: Edge[];
  onClear: () => void;
};

export const SelectedNodeInspector: FC<SelectedNodeInspectorProps> = ({
  selectedKey,
  relatedEdges,
  onClear,
}) => {
  return (
    <div className="tile p-4 flex flex-col gap-3 motion-safe:animate-fade-up">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-3">
          Dependency Inspection:{" "}
          <span className="text-ink font-mono">{selectedKey}</span>
        </h4>
        <Button
          variant="custom"
          type="button"
          onClick={onClear}
          className="text-xs text-ink-3 hover:text-ink cursor-pointer"
        >
          Clear selection
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Direct Blockers */}
        <div className="flex flex-col gap-1.5 rounded-xl border border-hairline bg-surface-subtle/40 p-3">
          <span className="text-[11px] font-medium text-ink-3">
            Blocked by (must finish before {selectedKey}):
          </span>
          {relatedEdges.filter((e) => e.targetKey === selectedKey).length ===
          0 ? (
            <p className="text-xs text-ink-3 italic">
              No blockers — ready to proceed.
            </p>
          ) : (
            relatedEdges
              .filter((e) => e.targetKey === selectedKey)
              .map((e) => (
                <div
                  key={e.sourceKey}
                  className="flex items-center justify-between text-xs py-0.5"
                >
                  <Link
                    href={paths.task(e.sourceKey)}
                    className="font-mono text-signal hover:underline"
                  >
                    {e.sourceKey}
                  </Link>
                  <span className="flex items-center gap-1 text-[11px] text-ink-3">
                    {e.isBlockerDone ? (
                      <span className="inline-flex items-center gap-1 text-success-text font-mono font-medium">
                        <CheckCircle2Icon className="size-3" /> Resolved
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-warning-text font-mono font-medium">
                        <ClockIcon className="size-3" /> Incomplete
                      </span>
                    )}
                  </span>
                </div>
              ))
          )}
        </div>

        {/* Direct Dependents */}
        <div className="flex flex-col gap-1.5 rounded-xl border border-hairline bg-surface-subtle/40 p-3">
          <span className="text-[11px] font-medium text-ink-3">
            Blocks (waiting on {selectedKey}):
          </span>
          {relatedEdges.filter((e) => e.sourceKey === selectedKey).length ===
          0 ? (
            <p className="text-xs text-ink-3 italic">
              Does not block any downstream tasks.
            </p>
          ) : (
            relatedEdges
              .filter((e) => e.sourceKey === selectedKey)
              .map((e) => (
                <div
                  key={e.targetKey}
                  className="flex items-center justify-between text-xs py-0.5"
                >
                  <Link
                    href={paths.task(e.targetKey)}
                    className="font-mono text-signal hover:underline"
                  >
                    {e.targetKey}
                  </Link>
                  <span className="flex items-center gap-1 text-[11px] text-ink-3 font-mono">
                    <ArrowRightIcon className="size-3 text-ink-3" />
                    {e.isBlockedDone ? "Done" : "Waiting"}
                  </span>
                </div>
              ))
          )}
        </div>
      </div>
    </div>
  );
};
