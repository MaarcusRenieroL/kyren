import { Textarea } from "@kyren/ui/shadcn/textarea";
import { Button } from "@kyren/ui/shadcn/button";
import { Input } from "@kyren/ui/shadcn/input";
import { Panel } from "./panel";

export function FeatureFlagsPanel({
  flagsValue,
  setFlagsText,
  busy,
  onSaveFlags,
}: {
  flagsValue: string;
  setFlagsText: (text: string | null) => void;
  busy: boolean;
  onSaveFlags: () => void;
}) {
  return (
    <Panel title="Feature flags">
      <p className="text-sm text-ink-2">
        A JSON object of flag names to true or false.
      </p>
      <Textarea
        aria-label="Feature flags"
        className="min-h-24 rounded-lg border border-line bg-canvas p-2 font-mono text-xs"
        value={flagsValue}
        onChange={(event) => setFlagsText(event.target.value)}
      />
      <div>
        <Button size="sm" disabled={busy} onClick={onSaveFlags}>
          Save flags
        </Button>
      </div>
    </Panel>
  );
}

export function LimitsPanel({
  membersValue,
  setMembers,
  storageValue,
  setStorage,
  busy,
  onSaveLimits,
}: {
  membersValue: string;
  setMembers: (m: string | null) => void;
  storageValue: string;
  setStorage: (s: string | null) => void;
  busy: boolean;
  onSaveLimits: () => void;
}) {
  return (
    <Panel title="Limits">
      <p className="text-sm text-ink-2">
        Leave a box empty for the default. Members counts open invitations.
      </p>
      <div className="flex flex-wrap gap-2">
        <Input
          aria-label="Member limit"
          placeholder="Members"
          className="w-32"
          inputMode="numeric"
          value={membersValue}
          onChange={(event) => setMembers(event.target.value)}
        />
        <Input
          aria-label="Storage limit in MB"
          placeholder="Storage (MB)"
          className="w-40"
          inputMode="numeric"
          value={storageValue}
          onChange={(event) => setStorage(event.target.value)}
        />
        <Button size="sm" disabled={busy} onClick={onSaveLimits}>
          Save limits
        </Button>
      </div>
    </Panel>
  );
}
