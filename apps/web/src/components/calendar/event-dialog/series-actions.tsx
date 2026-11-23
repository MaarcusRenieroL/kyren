import type { FC } from "react";
import { Button } from "@kyren/ui/shadcn/button";
import type { Occurrence } from "./types";

type SeriesActionsProps = {
  occurrence: Occurrence;
  busy: boolean;
  onEditOne?: (occurrence: Occurrence) => void;
  onDeleteOne?: (occurrence: Occurrence) => Promise<void>;
  onEditFollowing?: (occurrence: Occurrence) => void;
  onDeleteFollowing?: (occurrence: Occurrence) => Promise<void>;
  onError: (msg: string) => void;
  setBusy: (busy: boolean) => void;
};

export const SeriesActions: FC<SeriesActionsProps> = ({
  occurrence,
  busy,
  onEditOne,
  onDeleteOne,
  onEditFollowing,
  onDeleteFollowing,
  onError,
  setBusy,
}) => {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-line p-3 text-sm">
      <p className="text-ink-2">
        This event repeats. Saving here changes every event in the series; the
        buttons below change only part of it.
      </p>
      <div className="flex flex-wrap gap-2">
        {onEditOne ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => onEditOne(occurrence)}
          >
            Edit only this event
          </Button>
        ) : null}
        {onDeleteOne ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onDeleteOne(occurrence);
              } catch (err) {
                onError(
                  err instanceof Error ? err.message : "Could not delete.",
                );
                setBusy(false);
              }
            }}
          >
            Delete only this event
          </Button>
        ) : null}
        {onEditFollowing ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => onEditFollowing(occurrence)}
          >
            Edit this and following
          </Button>
        ) : null}
        {onDeleteFollowing ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onDeleteFollowing(occurrence);
              } catch (err) {
                onError(
                  err instanceof Error ? err.message : "Could not delete.",
                );
                setBusy(false);
              }
            }}
          >
            Delete this and following
          </Button>
        ) : null}
      </div>
    </div>
  );
};
