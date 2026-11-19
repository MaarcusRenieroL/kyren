"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  ChevronUpIcon,
  CircleIcon,
  RocketIcon,
  XIcon,
} from "lucide-react";

import { Button } from "@zentro/ui/shadcn/button";
import { Progress } from "@zentro/ui/shadcn/progress";
import { cn } from "@zentro/ui/lib/utils";

import type { StarterProgress } from "~/src/lib/starter-progress";

type Step = {
  id: keyof StarterProgress;
  title: string;
  description: string;
  href: string;
  actionText: string;
};

const steps: Step[] = [
  {
    id: "project",
    title: "Create your first project",
    description:
      "Group related tasks and docs under a project with its own key.",
    href: "/projects",
    actionText: "Go to Projects",
  },
  {
    id: "task",
    title: "Add a task",
    description: "Plan work on the board and give it an owner and a due date.",
    href: "/tasks",
    actionText: "Open Tasks",
  },
  {
    id: "doc",
    title: "Write a doc",
    description:
      "Name a task key such as ZEN-12 and the doc links to that task.",
    href: "/docs",
    actionText: "Draft a Doc",
  },
  {
    id: "whiteboard",
    title: "Sketch on a whiteboard",
    description: "Draw shapes, notes and arrows to plan with your team.",
    href: "/whiteboards",
    actionText: "Open Whiteboards",
  },
  {
    id: "team",
    title: "Invite your teammates",
    description: "Work together across tasks, docs, chat and tickets.",
    href: "/settings/organization/members",
    actionText: "Invite Members",
  },
];

/**
 * First steps for a new workspace. Each one is done when the workspace really
 * has it (worked out on the server), so nothing here can be ticked by hand,
 * and it goes away once every step is done.
 */
export function WorkspaceStarterChecklist({
  progress,
  organizationId,
  className,
}: {
  progress: StarterProgress;
  organizationId: string;
  className?: string;
}) {
  const storageKey = `zentro_starter_checklist_dismissed:${organizationId}`;
  const [collapsed, setCollapsed] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(storageKey) === "true");
    } catch {
      // Without storage the checklist simply shows.
    }
  }, [storageKey]);

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(storageKey, "true");
    } catch {
      // Without storage it is hidden until the next page load.
    }
  }

  const completedCount = steps.filter((step) => progress[step.id]).length;

  if (dismissed || completedCount === steps.length) return null;

  const progressPercent = Math.round((completedCount / steps.length) * 100);

  return (
    <section
      aria-label="Getting started"
      className={cn(
        "rounded-2xl border border-hairline bg-surface p-4 shadow-sm transition-all md:p-5",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-signal/15 text-signal">
            <RocketIcon className="size-4" aria-hidden />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-ink">
              Getting started with Zentro
            </h3>
            <p className="text-xs text-ink-3">
              {completedCount} of {steps.length} done
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="size-8 p-0"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "Expand checklist" : "Collapse checklist"}
            aria-expanded={!collapsed}
          >
            {collapsed ? (
              <ChevronDownIcon className="size-4" aria-hidden />
            ) : (
              <ChevronUpIcon className="size-4" aria-hidden />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="size-8 p-0 text-ink-3 hover:text-ink"
            onClick={dismiss}
            aria-label="Hide checklist"
          >
            <XIcon className="size-4" aria-hidden />
          </Button>
        </div>
      </div>

      <div className="mt-3">
        <Progress
          value={progressPercent}
          className="h-1.5"
          aria-label={`${completedCount} of ${steps.length} steps done`}
        />
      </div>

      {!collapsed ? (
        <ul className="mt-4 flex flex-col gap-2.5">
          {steps.map((step) => {
            const isDone = progress[step.id];

            return (
              <li
                key={step.id}
                className={cn(
                  "flex items-start justify-between gap-3 rounded-xl border border-hairline/60 p-3",
                  isDone ? "bg-surface-subtle/40 opacity-70" : "bg-surface",
                )}
              >
                <div className="flex items-start gap-3">
                  {isDone ? (
                    <CheckCircle2Icon
                      className="mt-0.5 size-4 shrink-0 text-signal"
                      aria-label="Done"
                    />
                  ) : (
                    <CircleIcon
                      className="mt-0.5 size-4 shrink-0 text-ink-3"
                      aria-label="Not done yet"
                    />
                  )}
                  <div className="flex flex-col gap-0.5">
                    <span
                      className={cn(
                        "text-xs font-medium text-ink",
                        isDone && "line-through text-ink-3",
                      )}
                    >
                      {step.title}
                    </span>
                    <span className="text-[11px] leading-snug text-ink-3">
                      {step.description}
                    </span>
                  </div>
                </div>

                {isDone ? null : (
                  <Link
                    href={step.href}
                    className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-signal hover:underline"
                  >
                    {step.actionText}
                    <ArrowRightIcon className="size-3" aria-hidden />
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
