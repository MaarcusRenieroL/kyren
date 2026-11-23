"use client";

import { Button } from "@kyren/ui/shadcn/button";
import { FC } from "react";
import { SparklesIcon, WorkflowIcon } from "lucide-react";

type AutomationsEmptyStateProps = {
  canRunEverywhere: boolean;
  isSubmitting: boolean;
  onSeedPresets: () => void;
};

export const AutomationsEmptyState: FC<AutomationsEmptyStateProps> = ({
  canRunEverywhere,
  isSubmitting,
  onSeedPresets,
}) => {
  return (
    <div className="tile p-12 text-center text-ink-3 flex flex-col items-center">
      <WorkflowIcon className="size-10 opacity-40 mb-3" />
      <h3 className="text-base font-semibold text-ink">
        No automations configured yet
      </h3>
      {canRunEverywhere ? (
        <>
          <p className="text-xs text-ink-3 max-w-sm mt-1 mb-5">
            Presets run on every project: they move a parent to review when its
            subtasks are done, assign tasks moved to in progress, start tasks
            whose blockers clear, and raise the priority of tasks due within a
            day.
          </p>
          <Button
            variant="custom"
            type="button"
            onClick={onSeedPresets}
            disabled={isSubmitting}
            className="inline-flex items-center gap-1.5 rounded-xl bg-ink px-4 py-2.5 text-xs font-semibold text-ink-inverse hover:bg-ink/90 transition-all cursor-pointer"
          >
            <SparklesIcon className="size-4" />
            <span>Add the preset automations</span>
          </Button>
        </>
      ) : (
        <p className="text-xs text-ink-3 max-w-sm mt-1">
          Create a rule for a project you work on. Rules for every project are
          set up by an admin.
        </p>
      )}
    </div>
  );
};
