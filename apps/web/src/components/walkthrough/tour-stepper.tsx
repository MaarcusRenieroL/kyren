"use client";

import { useState, useEffect } from "react";
import {
  CompassIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CheckIcon,
  LayersIcon,
  KanbanIcon,
  FileTextIcon,
  TicketIcon,
  UsersIcon,
} from "lucide-react";

import { Button } from "@zentro/ui/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@zentro/ui/shadcn/dialog";
import { Badge } from "@zentro/ui/shadcn/badge";
import { cn } from "@zentro/ui/lib/utils";

export type TourStep = {
  title: string;
  badge?: string;
  description: string;
  bullets?: string[];
};

export type TourDefinition = {
  id: string;
  moduleName: string;
  icon: typeof CompassIcon;
  steps: TourStep[];
};

export const tours: Record<string, TourDefinition> = {
  general: {
    id: "general",
    moduleName: "Workspace Essentials",
    icon: CompassIcon,
    steps: [
      {
        title: "Unified Command Palette",
        badge: "Keyboard First",
        description:
          "Press ⌘K anywhere in Zentro to search across Tasks, Projects, Docs, and Chat channels with instant debounce.",
        bullets: [
          "Search tasks by key (e.g. ZEN-42) or title",
          "Switch between dark and light themes instantly",
          "Jump straight into customer tickets and HR records",
        ],
      },
      {
        title: "3-Tier AI Copilot",
        badge: "Bottom-Right Dock",
        description:
          "Click the floating Sparkles button or press ⌘J to summon the Zentro AI Copilot for fast context queries and micro-ops.",
        bullets: [
          "Story point estimation using weighted Fibonacci algorithms",
          "Customer sentiment analysis and ticket triage",
          "Autonomous Workspace Custodian background sweeps",
        ],
      },
      {
        title: "Universal Work Embeds",
        badge: "Zero Context Switching",
        description:
          "Work flows naturally. Tasks can be live-embedded into Chat channels, Docs, and Whiteboards with interactive bidirectional status updates.",
        bullets: [
          "Change assignees directly from embedded message cards",
          "Toggle task completion states without leaving your conversation",
          "Cross-module work graph linking",
        ],
      },
    ],
  },
  tasks: {
    id: "tasks",
    moduleName: "Tasks & Sprints",
    icon: KanbanIcon,
    steps: [
      {
        title: "Optimistic Kanban & List Views",
        badge: "Sub-100ms UI",
        description:
          "Drag tasks between columns with zero layout flicker and instant optimistic local state caching.",
        bullets: [
          "Cycle priorities with keyboard shortcuts",
          "Group by project, assignee, or sprint",
          "Save custom filtered views to reuse with your team",
        ],
      },
      {
        title: "Agile Sprints & Burndown",
        badge: "Sprint Engine",
        description:
          "Plan cycles, allocate story points, track velocity, and automatically roll over unfinished deliverables to the backlog.",
        bullets: [
          "Drag tasks from backlog directly into active sprints",
          "Real-time burnup and velocity metrics",
          "Executive sprint briefing synthesis via Tier 3 AI",
        ],
      },
      {
        title: "Custom Fields & Templates",
        badge: "Flexibility",
        description:
          "Define organization-wide custom fields (number, date, dropdowns) and instantiate pre-built recurring task workflows.",
        bullets: [
          "Configurable per-project task templates",
          "Automated recurring tasks with cron-like cadences",
          "Custom field values synced across all task views",
        ],
      },
    ],
  },
  whiteboards: {
    id: "whiteboards",
    moduleName: "Spatial Whiteboards",
    icon: LayersIcon,
    steps: [
      {
        title: "Infinite 60fps Canvas",
        badge: "Spatial Engine",
        description:
          "Fluid pan and zoom with high-performance WebGL/SVG rendering designed for visual architecture and sprint roadmaps.",
        bullets: [
          "Pinch-to-zoom or scroll wheel canvas navigation",
          "Mini-map viewport orientation indicator",
          "Hardware-accelerated sticky note layout",
        ],
      },
      {
        title: "Live Database Tasks",
        badge: "Direct Sync",
        description:
          "Drag actual project tasks onto the board. They render as interactive cards that reflect live database statuses.",
        bullets: [
          "Check off subtasks directly on the canvas",
          "Real-time status badges and assignee avatars",
          "Double-click any node to open full task details",
        ],
      },
      {
        title: "Smart Dependency Anchors",
        badge: "Auto Blockers",
        description:
          "Connecting two task nodes with a bezier arrow automatically creates bidirectional 'Blocks / Blocked By' relations in Postgres.",
        bullets: [
          "4-way magnetic snap anchors (top, bottom, left, right)",
          "Collision-avoiding bezier curve paths",
          "Visual dependency bottleneck highlighting",
        ],
      },
    ],
  },
  docs: {
    id: "docs",
    moduleName: "Docs & Living Specs",
    icon: FileTextIcon,
    steps: [
      {
        title: "Rich Block-Based Typography",
        badge: "Distraction Free",
        description:
          "Enterprise Geist Sans typography with tight spatial rhythm, code blocks, callouts, and multi-column tables.",
        bullets: [
          "Clean distraction-free writing experience",
          "Real-time autosave with revision history snapshots",
          "Multi-tenant document access controls",
        ],
      },
      {
        title: "Living Spec Synthesis",
        badge: "Tier 3 AI",
        description:
          "Turn static documentation into living specs. The system inspects linked tasks and automatically suggests Markdown status updates.",
        bullets: [
          "Mentions of task keys (e.g. ZEN-12) auto-link to the work graph",
          "1-click living spec append generating completed capability diffs",
          "Autonomous Custodian doc auto-categorization",
        ],
      },
    ],
  },
  tickets: {
    id: "tickets",
    moduleName: "Support & SLA Engine",
    icon: TicketIcon,
    steps: [
      {
        title: "Multi-Queue Intake",
        badge: "Omnichannel",
        description:
          "Manage incoming requests through public intake forms, customer portal links, or inbound email ingestion.",
        bullets: [
          "Automated sequential numbering (SUP-1, SUP-2)",
          "Customer portal with passwordless magic links",
          "Public intake form generator with custom field validation",
        ],
      },
      {
        title: "SLA Rules & AI Triage",
        badge: "Automated Escalation",
        description:
          "Real-time countdown badges for first-response and resolution SLA targets, backed by automated background escalation.",
        bullets: [
          "Sentiment analysis and priority categorization (<50ms)",
          "Duplicate ticket detection using n-gram tokenization",
          "Internal agent notes vs. customer-facing replies",
        ],
      },
    ],
  },
  hr: {
    id: "hr",
    moduleName: "People & Enterprise",
    icon: UsersIcon,
    steps: [
      {
        title: "Employee Directory & Roles",
        badge: "RBAC Directory",
        description:
          "Searchable directory tracking reporting structures, job titles, departments, and linked sign-in accounts.",
        bullets: [
          "Bulk CSV people import with duplicate skipping",
          "Linked workspace user accounts and team assignments",
          "Role-based access boundary enforcement",
        ],
      },
      {
        title: "Leave Management & Dual-Control Payroll",
        badge: "Enterprise Guardrails",
        description:
          "Employee leave requests with manager approval, and strict dual-control payroll verification (approver ≠ creator).",
        bullets: [
          "Leave request approval and cancellation workflows",
          "Automated payroll calculation with bonus adjustments",
          "Immutable financial audit trail and pay run CSV exports",
        ],
      },
    ],
  },
};

export function TourStepper({
  tourId = "general",
  open,
  onOpenChange,
}: {
  tourId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [currentStep, setCurrentStep] = useState(0);

  const tour = tours[tourId] ?? tours.general!;
  const steps = tour.steps;
  const isFirst = currentStep === 0;
  const isLast = currentStep === steps.length - 1;

  // Reset to first step whenever reopened
  useEffect(() => {
    if (open) {
      setCurrentStep(0);
    }
  }, [open]);

  // Keyboard navigation: ArrowRight / ArrowLeft / Escape
  useEffect(() => {
    if (!open) return;

    function handleKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") {
        if (!isLast) setCurrentStep((prev) => prev + 1);
      } else if (e.key === "ArrowLeft") {
        if (!isFirst) setCurrentStep((prev) => prev - 1);
      }
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, isFirst, isLast]);

  const step = steps[currentStep]!;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6">
        <DialogHeader className="gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-signal/15 text-signal">
                <tour.icon className="size-4" />
              </span>
              <span className="text-xs font-semibold text-ink-3 uppercase tracking-wider">
                {tour.moduleName} Tour
              </span>
            </div>
            {step.badge ? (
              <Badge variant="secondary" className="text-[10px] font-mono">
                {step.badge}
              </Badge>
            ) : null}
          </div>

          <DialogTitle className="text-lg font-semibold text-ink mt-2">
            {step.title}
          </DialogTitle>
          <DialogDescription className="text-xs text-ink-3 leading-relaxed mt-1">
            {step.description}
          </DialogDescription>
        </DialogHeader>

        {step.bullets && step.bullets.length > 0 ? (
          <div className="my-3 flex flex-col gap-2 rounded-xl border border-hairline bg-surface-subtle/50 p-3.5">
            {step.bullets.map((bullet, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2 text-xs text-ink-2"
              >
                <CheckIcon className="size-3.5 shrink-0 text-signal mt-0.5" />
                <span>{bullet}</span>
              </div>
            ))}
          </div>
        ) : null}

        {/* Step Progress Indicators */}
        <div className="flex items-center justify-center gap-1.5 py-2">
          {steps.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setCurrentStep(idx)}
              aria-label={`Go to step ${idx + 1}`}
              className={cn(
                "h-1.5 rounded-full transition-all",
                idx === currentStep
                  ? "w-6 bg-signal"
                  : "w-1.5 bg-hairline hover:bg-ink-3",
              )}
            />
          ))}
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between pt-2">
          <span className="text-xs font-mono text-ink-3">
            Step {currentStep + 1} of {steps.length}
          </span>

          <div className="flex items-center gap-2">
            {!isFirst ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentStep((prev) => prev - 1)}
              >
                <ChevronLeftIcon className="size-3.5 mr-1" />
                Previous
              </Button>
            ) : null}

            {!isLast ? (
              <Button
                size="sm"
                onClick={() => setCurrentStep((prev) => prev + 1)}
              >
                Next
                <ChevronRightIcon className="size-3.5 ml-1" />
              </Button>
            ) : (
              <Button size="sm" onClick={() => onOpenChange(false)}>
                Finish Tour
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
