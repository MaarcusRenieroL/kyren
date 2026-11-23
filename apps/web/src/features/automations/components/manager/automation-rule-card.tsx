"use client";

import { Button } from "@zentro/ui/shadcn/button";
import { FC } from "react";
import { PowerIcon, Trash2Icon, WorkflowIcon } from "lucide-react";
import { cn } from "@zentro/ui/lib/utils";

import {
  ACTION_LABELS,
  AutomationRule,
  TRIGGER_LABELS,
} from "./automation-types";

type AutomationRuleCardProps = {
  rule: AutomationRule;
  onToggle: (rule: AutomationRule) => void;
  onDelete: (id: string, name: string) => void;
};

export const AutomationRuleCard: FC<AutomationRuleCardProps> = ({
  rule,
  onToggle,
  onDelete,
}) => {
  return (
    <div
      className={cn(
        "rounded-2xl border border-hairline bg-surface p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:border-hairline-strong hover:shadow-sm",
        !rule.enabled && "opacity-60",
      )}
    >
      <div className="flex items-start gap-3.5 min-w-0">
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-xl border",
            rule.enabled
              ? "bg-signal/10 border-signal/20 text-signal"
              : "bg-surface-subtle border-hairline text-ink-3",
          )}
        >
          <WorkflowIcon className="size-4" />
        </div>

        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-ink truncate">
              {rule.name}
            </span>
            {rule.enabled ? (
              <span className="rounded-md bg-success-subtle border border-success/30 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-success-text">
                ACTIVE
              </span>
            ) : (
              <span className="rounded-md bg-sunken px-1.5 py-0.5 font-mono text-[10px] text-ink-3">
                PAUSED
              </span>
            )}
          </div>

          {rule.description ? (
            <p className="text-xs text-ink-3 mt-0.5">{rule.description}</p>
          ) : null}

          {/* Trigger -> Action logic badge */}
          <div className="flex flex-wrap items-center gap-1.5 mt-2 text-[11px] font-mono text-ink-2">
            <span className="rounded bg-surface-subtle border border-hairline px-1.5 py-0.5">
              WHEN: {TRIGGER_LABELS[rule.triggerEvent] ?? rule.triggerEvent}
            </span>
            <span className="text-ink-3">→</span>
            <span className="rounded bg-surface-subtle border border-hairline px-1.5 py-0.5">
              THEN: {ACTION_LABELS[rule.actionType] ?? rule.actionType}
            </span>
          </div>
        </div>
      </div>

      {/* Stats & Controls */}
      <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-hairline/60">
        <div className="flex flex-col sm:items-end text-xs text-ink-3 font-mono">
          <span>{rule.runCount} executions</span>
          {rule.lastRunAt ? (
            <span className="text-[10px] text-ink-3">
              Last run: {new Date(rule.lastRunAt).toLocaleDateString()}
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="custom"
            type="button"
            onClick={() => onToggle(rule)}
            aria-pressed={rule.enabled}
            aria-label={`Run ${rule.name}`}
            className={cn(
              "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium cursor-pointer transition-colors",
              rule.enabled
                ? "border-success/30 bg-success-subtle text-success-text"
                : "border-hairline bg-surface text-ink-3 hover:text-ink",
            )}
          >
            <PowerIcon className="size-3" />
            <span>{rule.enabled ? "Enabled" : "Paused"}</span>
          </Button>

          <Button
            variant="custom"
            type="button"
            onClick={() => onDelete(rule.id, rule.name)}
            aria-label={`Delete ${rule.name}`}
            className="p-1.5 rounded-lg text-ink-3 hover:text-danger-text hover:bg-danger-subtle transition-colors cursor-pointer"
            title="Delete rule"
          >
            <Trash2Icon className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
