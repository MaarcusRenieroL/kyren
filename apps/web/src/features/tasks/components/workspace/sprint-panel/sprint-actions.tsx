import { Label } from "@kyren/ui/shadcn/label";
import { Button } from "@kyren/ui/shadcn/button";
import { NativeSelect } from "@kyren/ui/shadcn/native-select";
import type { AppRouter } from "@kyren/api/server";
import type { inferRouterOutputs } from "@trpc/server";

type Sprint = inferRouterOutputs<AppRouter>["sprint"]["list"][number];

export function SprintActions({
  target,
  unplannedCount,
  active,
  plannedFirst,
  busy,
  leftover,
  setLeftover,
  onAddUnplanned,
  onStartPlanned,
  onCompleteActive,
  onToggleCreating,
}: {
  target?: Sprint;
  unplannedCount: number;
  active?: Sprint;
  plannedFirst?: Sprint;
  busy: boolean;
  leftover: "next" | "backlog";
  setLeftover: (val: "next" | "backlog") => void;
  onAddUnplanned: () => void;
  onStartPlanned: () => void;
  onCompleteActive: () => void;
  onToggleCreating: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {target && unplannedCount > 0 ? (
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={onAddUnplanned}
        >
          Add {Math.min(unplannedCount, 200)} unplanned to {target.name}
        </Button>
      ) : null}

      {!active && plannedFirst ? (
        <Button size="sm" disabled={busy} onClick={onStartPlanned}>
          Start {plannedFirst.name}
        </Button>
      ) : null}

      {active ? (
        <>
          <Label className="flex items-center gap-1.5 text-xs text-ink-2">
            Unfinished work goes to
            <NativeSelect
              aria-label="Unfinished work goes to"
              size="sm"
              className="w-36 text-xs"
              value={leftover}
              onChange={(event) =>
                setLeftover(event.target.value as "next" | "backlog")
              }
            >
              <option value="next">the next sprint</option>
              <option value="backlog">the backlog</option>
            </NativeSelect>
          </Label>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={onCompleteActive}
          >
            Complete sprint
          </Button>
        </>
      ) : null}

      <Button size="sm" variant="ghost" onClick={onToggleCreating}>
        New sprint
      </Button>
    </div>
  );
}
