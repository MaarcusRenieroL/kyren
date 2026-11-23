"use client";

import { Button } from "@kyren/ui/shadcn/button";
import { Label } from "@kyren/ui/shadcn/label";
import { Input } from "@kyren/ui/shadcn/input";
import { FC, useState } from "react";
import { PlusIcon, WorkflowIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@kyren/ui/shadcn/dialog";

import { AutomationActionForm } from "./automation-action-form";
import { AutomationTriggerForm } from "./automation-trigger-form";
import type { ActionType, TriggerEvent } from "./automation-types";

type CreateAutomationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canRunEverywhere: boolean;
  channels: Array<{ id: string; name: string }>;
  projectOptions: Array<{ id: string; name: string }>;
  onSubmit: (params: {
    name: string;
    description: string | null;
    triggerEvent: TriggerEvent;
    triggerConfig: Record<string, unknown>;
    actionType: ActionType;
    actionConfig: Record<string, unknown>;
    projectId: string | null;
  }) => Promise<void>;
};

export const CreateAutomationDialog: FC<CreateAutomationDialogProps> = ({
  open,
  onOpenChange,
  canRunEverywhere,
  channels,
  projectOptions,
  onSubmit,
}) => {
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [triggerEvent, setTriggerEvent] = useState<TriggerEvent>(
    "task.subtasks_all_done",
  );
  const [toStatus, setToStatus] = useState("in-progress");
  const [actionType, setActionType] = useState<ActionType>("update_status");
  const [contains, setContains] = useState("");
  const [triggerChannelId, setTriggerChannelId] = useState("");
  const [postChannelId, setPostChannelId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [targetStatus, setTargetStatus] = useState("review");
  const [priority, setPriority] = useState("high");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setNameError("Give the rule a name.");
      return;
    }

    if (!projectId && (!canRunEverywhere || actionType === "create_task")) {
      return;
    }

    setIsSubmitting(true);
    try {
      const triggerConfig =
        triggerEvent === "task.status_changed"
          ? { toStatus }
          : triggerEvent === "chat.message_contains"
            ? {
                contains: contains.trim(),
                ...(triggerChannelId ? { channelId: triggerChannelId } : {}),
              }
            : {};

      const actionConfig =
        actionType === "update_status"
          ? { targetStatus }
          : actionType === "set_priority"
            ? { priority }
            : actionType === "post_to_channel"
              ? { channelId: postChannelId }
              : {};

      await onSubmit({
        name: name.trim(),
        description: description.trim() || null,
        triggerEvent,
        triggerConfig,
        actionType,
        actionConfig,
        projectId: projectId || null,
      });

      setName("");
      setDescription("");
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="custom"
          type="button"
          className="inline-flex items-center gap-1.5 rounded-xl bg-ink px-3 py-2 text-xs font-semibold text-ink-inverse hover:bg-ink/90 transition-all cursor-pointer"
        >
          <PlusIcon className="size-3.5" />
          <span>New automation</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md rounded-2xl border border-hairline bg-surface p-6 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold text-ink">
            <WorkflowIcon className="size-4 text-signal" />
            New automation rule
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-3">
          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor="automation-name"
              className="text-xs font-medium text-ink"
            >
              Rule name
            </Label>
            <Input
              id="automation-name"
              type="text"
              required
              value={name}
              aria-invalid={nameError ? true : undefined}
              aria-describedby={nameError ? "automation-name-error" : undefined}
              onChange={(e) => {
                setName(e.target.value);
                setNameError(null);
              }}
              placeholder="e.g. Auto-move to Review when done"
              className="h-9 rounded-lg border border-hairline bg-surface-subtle px-3 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            {nameError ? (
              <p
                id="automation-name-error"
                role="alert"
                className="text-xs text-danger-text"
              >
                {nameError}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor="automation-description"
              className="text-xs font-medium text-ink"
            >
              Description (optional)
            </Label>
            <Input
              id="automation-description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explain what this automation does"
              className="h-9 rounded-lg border border-hairline bg-surface-subtle px-3 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <AutomationTriggerForm
            triggerEvent={triggerEvent}
            setTriggerEvent={setTriggerEvent}
            contains={contains}
            setContains={setContains}
            triggerChannelId={triggerChannelId}
            setTriggerChannelId={setTriggerChannelId}
            toStatus={toStatus}
            setToStatus={setToStatus}
            channels={channels}
          />

          <AutomationActionForm
            actionType={actionType}
            setActionType={setActionType}
            triggerEvent={triggerEvent}
            postChannelId={postChannelId}
            setPostChannelId={setPostChannelId}
            projectId={projectId}
            setProjectId={setProjectId}
            canRunEverywhere={canRunEverywhere}
            channels={channels}
            projectOptions={projectOptions}
            targetStatus={targetStatus}
            setTargetStatus={setTargetStatus}
            priority={priority}
            setPriority={setPriority}
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="custom"
              type="button"
              onClick={() => onOpenChange(false)}
              className="h-9 rounded-xl border border-hairline px-3 text-xs text-ink-2 hover:bg-hover cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              variant="custom"
              type="submit"
              disabled={isSubmitting}
              className="h-9 rounded-xl bg-ink px-4 text-xs font-semibold text-ink-inverse hover:bg-ink/90 cursor-pointer"
            >
              Create rule
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
