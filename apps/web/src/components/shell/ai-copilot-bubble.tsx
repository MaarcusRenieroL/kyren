"use client";

import { useState, useEffect, type FormEvent } from "react";
import Link from "next/link";
import {
  SparklesIcon,
  SearchIcon,
  FileTextIcon,
  TicketIcon,
  CheckCircle2Icon,
  Loader2Icon,
} from "lucide-react";

import { useTrpcClient } from "@zentro/api/react";
import { Button } from "@zentro/ui/shadcn/button";
import { Input } from "@zentro/ui/shadcn/input";
import { Textarea } from "@zentro/ui/shadcn/textarea";
import { Badge } from "@zentro/ui/shadcn/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@zentro/ui/shadcn/sheet";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@zentro/ui/shadcn/tabs";
import { toastSuccess, toastError } from "@zentro/ui/index";

import { usePermission } from "~/src/components/permissions/permission-provider";

export function AiCopilotBubble() {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("search");
  const trpc = useTrpcClient();
  // The sweep rewrites links across the organization, so only admins run it.
  const canSweep = usePermission("org.settings.update");

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);

  // Story point estimator state
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [pointResult, setPointResult] = useState<any>(null);
  const [pointLoading, setPointLoading] = useState(false);

  // Ticket triage state
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketBody, setTicketBody] = useState("");
  const [triageResult, setTriageResult] = useState<any>(null);
  const [triageLoading, setTriageLoading] = useState(false);

  // Custodian sweep state
  const [sweepResult, setSweepResult] = useState<any>(null);
  const [sweepLoading, setSweepLoading] = useState(false);

  // Keyboard shortcut: Cmd/Ctrl + J to toggle
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    try {
      const hits = await trpc.ai.semanticSearch.query({
        query: searchQuery.trim(),
        limit: 8,
      });
      setSearchResults(hits);
    } catch (err) {
      toastError(err, "Search failed.");
    } finally {
      setSearchLoading(false);
    }
  }

  async function handleEstimatePoints(e: FormEvent) {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    setPointLoading(true);
    try {
      const res = await trpc.ai.suggestStoryPoints.query({
        title: taskTitle.trim(),
        description: taskDesc.trim() || undefined,
      });
      setPointResult(res);
      toastSuccess(`Estimated ${res.points} story points.`);
    } catch (err) {
      toastError(err, "Point estimation failed.");
    } finally {
      setPointLoading(false);
    }
  }

  async function handleTriage(e: FormEvent) {
    e.preventDefault();
    if (!ticketSubject.trim() || !ticketBody.trim()) return;
    setTriageLoading(true);
    try {
      const res = await trpc.ai.triageTicket.query({
        subject: ticketSubject.trim(),
        body: ticketBody.trim(),
      });
      setTriageResult(res);
      toastSuccess(`Ticket categorized as ${res.category} (${res.priority}).`);
    } catch (err) {
      toastError(err, "Triage failed.");
    } finally {
      setTriageLoading(false);
    }
  }

  async function handleRunSweep() {
    setSweepLoading(true);
    try {
      const res = await trpc.custodian.runSweep.mutate({ dryRun: false });
      setSweepResult(res);
      toastSuccess(
        `Custodian sweep completed: ${res.staleTasksCount} stale tasks, ${res.linksCreated} doc links.`,
      );
    } catch (err) {
      toastError(err, "Custodian sweep failed.");
    } finally {
      setSweepLoading(false);
    }
  }

  return (
    <>
      {/* Floating Copilot Button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open AI Copilot"
        className="fixed bottom-6 right-6 z-40 flex size-12 items-center justify-center rounded-full border border-hairline bg-surface text-signal shadow-lg transition-transform hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <SparklesIcon className="size-5" />
      </button>

      {/* Copilot Drawer Sheet */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="flex w-full flex-col sm:max-w-md p-0"
        >
          <SheetHeader className="border-b border-hairline p-4 pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-lg bg-signal/15 text-signal">
                  <SparklesIcon className="size-4" />
                </span>
                <SheetTitle className="text-base font-semibold">
                  Zentro Copilot
                </SheetTitle>
              </div>
            </div>
            <SheetDescription className="text-xs text-ink-3">
              Search the work you can see, quick keyword estimates, and
              workspace upkeep.
            </SheetDescription>
          </SheetHeader>

          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex flex-1 flex-col overflow-hidden"
          >
            <TabsList
              className={`grid ${canSweep ? "grid-cols-3" : "grid-cols-2"} border-b border-hairline bg-surface-subtle p-1 rounded-none`}
            >
              <TabsTrigger value="search" className="text-xs">
                Context
              </TabsTrigger>
              <TabsTrigger value="microops" className="text-xs">
                Micro-Ops
              </TabsTrigger>
              {canSweep ? (
                <TabsTrigger value="custodian" className="text-xs">
                  Custodian
                </TabsTrigger>
              ) : null}
            </TabsList>

            {/* Tab 1: Semantic Search */}
            <TabsContent
              value="search"
              className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 m-0"
            >
              <form onSubmit={handleSearch} className="flex gap-2">
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Ask or search tasks, docs, tickets..."
                  className="text-xs"
                />
                <Button
                  size="sm"
                  type="submit"
                  disabled={searchLoading || !searchQuery.trim()}
                >
                  {searchLoading ? (
                    <Loader2Icon className="size-3.5 animate-spin" />
                  ) : (
                    <SearchIcon className="size-3.5" />
                  )}
                </Button>
              </form>

              <div className="flex flex-col gap-2 flex-1">
                {searchResults.length === 0 && !searchLoading ? (
                  <div className="flex flex-col items-center justify-center p-8 text-center text-ink-3">
                    <SearchIcon className="size-8 opacity-30 mb-2" />
                    <p className="text-xs">
                      Type a keyword or question to search with tenant-isolated
                      hybrid matching.
                    </p>
                  </div>
                ) : (
                  searchResults.map((hit) => (
                    <Link
                      key={`${hit.type}-${hit.id}`}
                      href={hit.href}
                      onClick={() => setOpen(false)}
                      className="group flex flex-col gap-1 rounded-lg border border-hairline p-2.5 transition-colors hover:bg-hover"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          {hit.type === "task" ? (
                            <CheckCircle2Icon className="size-3.5 text-signal" />
                          ) : hit.type === "doc" ? (
                            <FileTextIcon className="size-3.5 text-tint-teams" />
                          ) : (
                            <TicketIcon className="size-3.5 text-tint-sun" />
                          )}
                          <span className="font-mono text-[11px] font-semibold text-ink-2">
                            {hit.key}
                          </span>
                        </div>
                        <span className="text-[10px] text-ink-3 uppercase">
                          {hit.type}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-ink group-hover:underline">
                        {hit.title}
                      </p>
                      {hit.snippet ? (
                        <p className="line-clamp-2 text-[11px] text-ink-3">
                          {hit.snippet}
                        </p>
                      ) : null}
                    </Link>
                  ))
                )}
              </div>
            </TabsContent>

            {/* Tab 2: Micro-Operations */}
            <TabsContent
              value="microops"
              className="flex-1 overflow-y-auto p-4 flex flex-col gap-5 m-0"
            >
              {/* Story Point Estimator */}
              <div className="flex flex-col gap-2.5 rounded-lg border border-hairline p-3">
                <span className="text-xs font-semibold text-ink">
                  Story Point Estimator (Fibonacci)
                </span>
                <form
                  onSubmit={handleEstimatePoints}
                  className="flex flex-col gap-2"
                >
                  <Input
                    placeholder="Task title (e.g. Refactor WebRTC engine)"
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    className="text-xs"
                  />
                  <Textarea
                    placeholder="Scope or technical details (optional)"
                    rows={2}
                    value={taskDesc}
                    onChange={(e) => setTaskDesc(e.target.value)}
                    className="text-xs"
                  />
                  <Button
                    size="sm"
                    type="submit"
                    disabled={pointLoading || !taskTitle.trim()}
                  >
                    {pointLoading ? "Calculating..." : "Estimate Points"}
                  </Button>
                </form>

                {pointResult ? (
                  <div className="mt-2 flex items-center justify-between rounded-md bg-surface-subtle p-2">
                    <span className="text-xs text-ink-2">
                      Recommended Points:
                    </span>
                    <Badge variant="default" className="font-mono text-xs">
                      {pointResult.points} SP
                    </Badge>
                  </div>
                ) : null}
              </div>

              {/* Automated Support Ticket Triage */}
              <div className="flex flex-col gap-2.5 rounded-lg border border-hairline p-3">
                <span className="text-xs font-semibold text-ink">
                  Ticket Triage & Sentiment Analysis
                </span>
                <form onSubmit={handleTriage} className="flex flex-col gap-2">
                  <Input
                    placeholder="Ticket subject"
                    value={ticketSubject}
                    onChange={(e) => setTicketSubject(e.target.value)}
                    className="text-xs"
                  />
                  <Textarea
                    placeholder="Customer body message"
                    rows={2}
                    value={ticketBody}
                    onChange={(e) => setTicketBody(e.target.value)}
                    className="text-xs"
                  />
                  <Button
                    size="sm"
                    type="submit"
                    disabled={
                      triageLoading ||
                      !ticketSubject.trim() ||
                      !ticketBody.trim()
                    }
                  >
                    {triageLoading ? "Analyzing..." : "Triage Ticket"}
                  </Button>
                </form>

                {triageResult ? (
                  <div className="mt-2 flex flex-col gap-1.5 rounded-md bg-surface-subtle p-2.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-ink-3">Sentiment:</span>
                      <span className="font-semibold capitalize text-ink">
                        {triageResult.sentiment}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ink-3">Priority:</span>
                      <Badge
                        variant="outline"
                        className="capitalize text-[10px]"
                      >
                        {triageResult.priority}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ink-3">Category:</span>
                      <span className="font-semibold capitalize text-ink">
                        {triageResult.category}
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>
            </TabsContent>

            {/* Tab 3: Workspace Custodian */}
            {canSweep ? (
              <TabsContent
                value="custodian"
                className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 m-0"
              >
                <div className="flex flex-col gap-2 rounded-lg border border-hairline p-3.5">
                  <span className="text-xs font-semibold text-ink">
                    Workspace upkeep
                  </span>
                  <p className="text-xs text-ink-3 leading-relaxed">
                    Flags tasks untouched for 14 days and open tickets older
                    than a day, and links docs to the task keys they mention.
                  </p>
                  <Button
                    size="sm"
                    onClick={handleRunSweep}
                    disabled={sweepLoading}
                    className="mt-1"
                  >
                    {sweepLoading
                      ? "Running Sweep..."
                      : "Run Workspace Maintenance"}
                  </Button>
                </div>

                {sweepResult ? (
                  <div className="flex flex-col gap-2.5 rounded-lg border border-hairline p-3 text-xs">
                    <span className="font-semibold text-ink">
                      Sweep Summary
                    </span>
                    <div className="flex justify-between border-b border-hairline py-1">
                      <span className="text-ink-3">Stale Tasks Flagged:</span>
                      <span className="font-mono font-medium">
                        {sweepResult.staleTasksCount}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-hairline py-1">
                      <span className="text-ink-3">
                        Doc-to-Task Links Created:
                      </span>
                      <span className="font-mono font-medium">
                        {sweepResult.linksCreated}
                      </span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-ink-3">SLA Breach Warnings:</span>
                      <span className="font-mono font-medium">
                        {sweepResult.slaRiskCount}
                      </span>
                    </div>
                  </div>
                ) : null}
              </TabsContent>
            ) : null}
          </Tabs>
        </SheetContent>
      </Sheet>
    </>
  );
}
