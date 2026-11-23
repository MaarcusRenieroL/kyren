import { Button } from "@kyren/ui/shadcn/button";
import { Input } from "@kyren/ui/shadcn/input";
import { Panel } from "./panel";

export function TenantActionsPanel({
  reason,
  setReason,
  busy,
  needsReason,
  isSuspended,
  hasDeletionScheduled,
  onInspect,
  onExport,
  onSuspend,
  onReactivate,
}: {
  reason: string;
  setReason: (r: string) => void;
  busy: boolean;
  needsReason: boolean;
  isSuspended: boolean;
  hasDeletionScheduled: boolean;
  onInspect: () => void;
  onExport: () => void;
  onSuspend: () => void;
  onReactivate: () => void;
}) {
  return (
    <Panel title="A reason for the actions below">
      <p className="text-sm text-ink-2">
        Looking inside, exporting and suspending are written to the audit
        trail with this reason.
      </p>
      <Input
        aria-label="Reason"
        placeholder="e.g. Support ticket 1234"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={busy || needsReason}
          onClick={onInspect}
        >
          Look inside (read-only)
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy || needsReason}
          onClick={onExport}
        >
          Export data
        </Button>
        {!isSuspended ? (
          <Button
            size="sm"
            variant="outline"
            disabled={busy || needsReason}
            onClick={onSuspend}
          >
            Suspend
          </Button>
        ) : !hasDeletionScheduled ? (
          <Button
            size="sm"
            disabled={busy}
            onClick={onReactivate}
          >
            Reactivate
          </Button>
        ) : null}
      </div>
    </Panel>
  );
}
