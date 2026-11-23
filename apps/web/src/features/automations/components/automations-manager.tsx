"use client";

import { Button } from "@kyren/ui/shadcn/button";
import { FC, useEffect, useState } from "react";
import { ClockIcon, ZapIcon } from "lucide-react";

import { useTrpcClient } from "@kyren/api/react";
import { toastError, toastSuccess } from "@kyren/ui/index";

import { usePermission } from "~/src/components/permissions/permission-provider";
import { AutomationRuleCard } from "./manager/automation-rule-card";
import type {
  ActionType,
  AutomationRule,
  TriggerEvent,
} from "./manager/automation-types";
import { AutomationsEmptyState } from "./manager/automations-empty-state";
import { CreateAutomationDialog } from "./manager/create-automation-dialog";

export const AutomationsManager: FC = () => {
  const trpc = useTrpcClient();
  const canRunEverywhere = usePermission("org.settings.update");
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [channels, setChannels] = useState<Array<{ id: string; name: string }>>(
    [],
  );
  const [projectOptions, setProjectOptions] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEscalating, setIsEscalating] = useState(false);

  const fetchRules = async () => {
    try {
      const data = await trpc.automation.getAll.query();
      setRules(data as unknown as AutomationRule[]);
    } catch {
      toastError("Error", "Could not load automations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchRules();

    void trpc.chat.sidebar
      .query()
      .then((data) =>
        setChannels(
          data.channels
            .filter(
              (channel) =>
                channel.kind === "channel" && !channel.archived && channel.name,
            )
            .map((channel) => ({ id: channel.id, name: channel.name! })),
        ),
      )
      .catch(() => undefined);

    void trpc.project.getProjectsByOrgId
      .query()
      .then((rows) =>
        setProjectOptions(
          (rows as Array<{ id: string; name: string }>).map((row) => ({
            id: row.id,
            name: row.name,
          })),
        ),
      )
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggle = async (rule: AutomationRule) => {
    const nextState = !rule.enabled;
    setRules((prev) =>
      prev.map((r) => (r.id === rule.id ? { ...r, enabled: nextState } : r)),
    );

    try {
      await trpc.automation.toggle.mutate({
        id: rule.id,
        enabled: nextState,
      });
      toastSuccess(
        nextState ? `Activated ${rule.name}` : `Paused ${rule.name}`,
      );
    } catch {
      setRules((prev) =>
        prev.map((r) => (r.id === rule.id ? { ...r, enabled: !nextState } : r)),
      );
      toastError("Error", "Could not toggle automation");
    }
  };

  const handleDelete = async (id: string, ruleName: string) => {
    if (
      !window.confirm(`Delete the rule "${ruleName}"? This cannot be undone.`)
    ) {
      return;
    }

    setRules((prev) => prev.filter((r) => r.id !== id));
    try {
      await trpc.automation.delete.mutate({ id });
      toastSuccess(`Deleted rule "${ruleName}"`);
    } catch {
      void fetchRules();
      toastError("Error", "Failed to delete automation");
    }
  };

  const handleSeedPresets = async () => {
    setIsSubmitting(true);
    try {
      const res = await trpc.automation.seedPresets.mutate();
      if (res.count > 0) {
        toastSuccess(`Added ${res.count} preset automations`);
      } else {
        toastSuccess("Presets already active.");
      }
      void fetchRules();
    } catch {
      toastError("Error", "Could not seed presets");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRunEscalation = async () => {
    setIsEscalating(true);
    try {
      const res = await trpc.automation.escalateDueSLA.mutate();
      if (res.escalatedCount > 0) {
        toastSuccess(
          `Escalated ${res.escalatedCount} task(s) approaching deadline to the rule's priority.`,
        );
      } else {
        toastSuccess(
          "Nothing to escalate. Turn on a due-date rule first if you have not.",
        );
      }
      void fetchRules();
    } catch {
      toastError("Error", "Failed to run SLA escalation check");
    } finally {
      setIsEscalating(false);
    }
  };

  const handleCreateRule = async (params: {
    name: string;
    description: string | null;
    triggerEvent: TriggerEvent;
    triggerConfig: Record<string, unknown>;
    actionType: ActionType;
    actionConfig: Record<string, unknown>;
    projectId: string | null;
  }) => {
    try {
      await trpc.automation.create.mutate(params);
      toastSuccess(`Created automation "${params.name}"`);
      void fetchRules();
    } catch (error) {
      toastError(
        "Error",
        error instanceof Error && error.message
          ? error.message
          : "Failed to create automation rule",
      );
      throw error;
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="tile p-6 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-signal/10 border border-signal/20 text-signal">
            <ZapIcon className="size-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-ink">Automations</h2>
            <p className="text-xs text-ink-3 mt-0.5">
              Rules that move, assign or prioritise tasks when something
              happens, so nobody has to do it by hand.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="custom"
            type="button"
            onClick={handleRunEscalation}
            disabled={isEscalating}
            className="inline-flex items-center gap-1.5 rounded-xl border border-warning/40 bg-warning-subtle px-3 py-2 text-xs font-semibold text-warning-text hover:bg-warning/20 transition-all cursor-pointer"
            title="Scan and escalate tasks within 24 hours of deadline"
          >
            <ClockIcon className="size-3.5" />
            <span>
              {isEscalating ? "Checking…" : "Raise priority of tasks due soon"}
            </span>
          </Button>

          <CreateAutomationDialog
            open={createOpen}
            onOpenChange={setCreateOpen}
            canRunEverywhere={canRunEverywhere}
            channels={channels}
            projectOptions={projectOptions}
            onSubmit={handleCreateRule}
          />
        </div>
      </div>

      {loading ? (
        <div className="tile p-12 text-center text-ink-3 text-sm">
          Loading automations...
        </div>
      ) : rules.length === 0 ? (
        <AutomationsEmptyState
          canRunEverywhere={canRunEverywhere}
          isSubmitting={isSubmitting}
          onSeedPresets={handleSeedPresets}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {rules.map((rule) => (
            <AutomationRuleCard
              key={rule.id}
              rule={rule}
              onToggle={handleToggle}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
};
