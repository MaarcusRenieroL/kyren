"use client";

import { Button } from "@kyren/ui/shadcn/button";
import { Input } from "@kyren/ui/shadcn/input";
import { useEffect, useMemo, useState, type FC } from "react";
import {
  AlertTriangleIcon,
  FilterIcon,
  FlameIcon,
  LayersIcon,
  NetworkIcon,
  SearchIcon,
} from "lucide-react";

import { useTrpcClient } from "@kyren/api/react";
import { cn } from "@kyren/ui/lib/utils";
import type { GraphData, Node } from "./critical-path/types";
import { MetricsCards } from "./critical-path/metrics-cards";
import { DagStageNode } from "./critical-path/dag-stage-node";
import { SelectedNodeInspector } from "./critical-path/selected-node-inspector";

type Props = {
  projectSlug: string;
};

export const CriticalPathVisualizer: FC<Props> = ({ projectSlug }) => {
  const trpc = useTrpcClient();
  const [data, setData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterMode, setFilterMode] = useState<
    "all" | "critical" | "bottlenecks"
  >("all");
  const [search, setSearch] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    trpc.project.getDependencyGraph
      .query({ slug: projectSlug })
      .then((res) => {
        if (active) {
          setData(res as unknown as GraphData);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [projectSlug, trpc]);

  const nodes = useMemo(() => data?.nodes ?? [], [data]);
  const edges = useMemo(() => data?.edges ?? [], [data]);
  const metrics = data?.metrics ?? {
    totalTasks: 0,
    totalDependencies: 0,
    criticalPathLength: 0,
    blockedTasksCount: 0,
    bottlenecksCount: 0,
    riskLevel: "low" as const,
  };

  const filteredNodes = useMemo(() => {
    let result = nodes;
    if (filterMode === "critical") {
      result = result.filter((n) => n.isCritical);
    } else if (filterMode === "bottlenecks") {
      result = result.filter((n) => n.isBottleneck || n.blockedByCount > 0);
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (n) =>
          n.key.toLowerCase().includes(q) || n.title.toLowerCase().includes(q),
      );
    }

    return result;
  }, [nodes, filterMode, search]);

  const stages = useMemo(() => {
    const map = new Map<number, Node[]>();
    for (const node of filteredNodes) {
      const stageList = map.get(node.stage) ?? [];
      stageList.push(node);
      map.set(node.stage, stageList);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a - b);
  }, [filteredNodes]);

  const relatedEdges = useMemo(() => {
    if (!selectedKey) return [];
    return edges.filter(
      (e) => e.sourceKey === selectedKey || e.targetKey === selectedKey,
    );
  }, [selectedKey, edges]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-ink-3">
        <NetworkIcon className="size-8 animate-pulse text-signal mb-3" />
        <p className="text-sm">
          Analyzing project dependency DAG & critical path...
        </p>
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div className="tile p-12 text-center text-ink-3">
        <NetworkIcon className="mx-auto size-9 opacity-40 mb-3" />
        <h3 className="text-base font-semibold text-ink">
          No tasks found in project
        </h3>
        <p className="text-sm mt-1">
          Create tasks and link them as blockers to visualize the critical path.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <MetricsCards metrics={metrics} />

      {/* Filter & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-hairline/80 bg-surface/80 p-3 shadow-2xs">
        <div className="flex items-center gap-1.5">
          <FilterIcon className="size-3.5 text-ink-3 ml-1" />
          <Button
            variant="custom"
            type="button"
            onClick={() => setFilterMode("all")}
            className={cn(
              "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
              filterMode === "all"
                ? "bg-ink text-ink-inverse"
                : "text-ink-2 hover:bg-hover hover:text-ink",
            )}
          >
            All Work ({nodes.length})
          </Button>
          <Button
            variant="custom"
            type="button"
            onClick={() => setFilterMode("critical")}
            className={cn(
              "inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
              filterMode === "critical"
                ? "bg-signal text-on-signal font-semibold"
                : "text-ink-2 hover:bg-hover hover:text-ink",
            )}
          >
            <FlameIcon className="size-3" />
            Critical Path ({metrics.criticalPathLength})
          </Button>
          <Button
            variant="custom"
            type="button"
            onClick={() => setFilterMode("bottlenecks")}
            className={cn(
              "inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
              filterMode === "bottlenecks"
                ? "bg-warning text-on-warning font-semibold"
                : "text-ink-2 hover:bg-hover hover:text-ink",
            )}
          >
            <AlertTriangleIcon className="size-3" />
            Bottlenecks ({metrics.bottlenecksCount})
          </Button>
        </div>

        <div className="relative h-8 w-full sm:w-56">
          <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-ink-3" />
          <Input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by key or title..."
            className="h-full w-full rounded-lg border border-hairline bg-surface pr-3 pl-8 text-xs outline-none placeholder:text-ink-3 focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>

      {/* DAG Stage Pipeline Visualizer */}
      <div className="overflow-x-auto pb-4">
        <div className="flex min-w-[700px] gap-5 items-start">
          {stages.map(([stageIdx, stageNodes]) => (
            <div
              key={stageIdx}
              className="flex-1 min-w-[220px] flex flex-col gap-3 rounded-2xl border border-hairline/70 bg-surface-subtle/30 p-3"
            >
              <div className="flex items-center justify-between pb-2 border-b border-hairline/60">
                <div className="flex items-center gap-1.5">
                  <LayersIcon className="size-3.5 text-ink-3" />
                  <span className="font-semibold text-xs text-ink">
                    {stageIdx === 0
                      ? "Phase 1: Roots / Unblocked"
                      : `Phase ${stageIdx + 1}: Dependent Work`}
                  </span>
                </div>
                <span className="font-mono text-[11px] text-ink-3">
                  {stageNodes.length} tasks
                </span>
              </div>

              <div className="flex flex-col gap-2.5">
                {stageNodes.map((node) => (
                  <DagStageNode
                    key={node.id}
                    node={node}
                    isSelected={selectedKey === node.key}
                    onSelect={() =>
                      setSelectedKey((prev) =>
                        prev === node.key ? null : node.key,
                      )
                    }
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectedKey ? (
        <SelectedNodeInspector
          selectedKey={selectedKey}
          relatedEdges={relatedEdges}
          onClear={() => setSelectedKey(null)}
        />
      ) : null}
    </div>
  );
};
