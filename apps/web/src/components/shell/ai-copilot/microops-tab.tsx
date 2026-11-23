"use client";

import { useState, type FormEvent, type FC } from "react";
import { useTrpcClient } from "@kyren/api/react";
import { Button } from "@kyren/ui/shadcn/button";
import { Input } from "@kyren/ui/shadcn/input";
import { Textarea } from "@kyren/ui/shadcn/textarea";
import { Badge } from "@kyren/ui/shadcn/badge";
import { TabsContent } from "@kyren/ui/shadcn/tabs";
import { toastSuccess, toastError } from "@kyren/ui/index";
import type { StoryPointResult, TriageResult } from "./types";

export const MicroOpsTab: FC = () => {
  const trpc = useTrpcClient();

  // Story point estimator state
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [pointResult, setPointResult] = useState<StoryPointResult | null>(null);
  const [pointLoading, setPointLoading] = useState(false);

  // Ticket triage state
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketBody, setTicketBody] = useState("");
  const [triageResult, setTriageResult] = useState<TriageResult | null>(null);
  const [triageLoading, setTriageLoading] = useState(false);

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

  return (
    <TabsContent
      value="microops"
      className="flex-1 overflow-y-auto p-4 flex flex-col gap-5 m-0"
    >
      {/* Story Point Estimator */}
      <div className="flex flex-col gap-2.5 rounded-lg border border-hairline p-3">
        <span className="text-xs font-semibold text-ink">
          Story Point Estimator (Fibonacci)
        </span>
        <form onSubmit={handleEstimatePoints} className="flex flex-col gap-2">
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
            <span className="text-xs text-ink-2">Recommended Points:</span>
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
              triageLoading || !ticketSubject.trim() || !ticketBody.trim()
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
              <Badge variant="outline" className="capitalize text-[10px]">
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
  );
};
