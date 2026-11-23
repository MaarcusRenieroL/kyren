"use client";

import {
  Dialog,
  DialogContent,
} from "@kyren/ui/shadcn/dialog";
import {
  colors,
  type CalendarEventItem,
  type EventColor,
  type EventDraft,
  type EventDialogProps,
  type Occurrence,
  type Repeat,
} from "./event-dialog/types";
import { EventForm } from "./event-dialog/event-form";

export { colors };
export type {
  CalendarEventItem,
  EventColor,
  EventDraft,
  Occurrence,
  Repeat,
};

export function EventDialog({
  draft,
  readOnly,
  createdBy,
  onClose,
  onSave,
  onDelete,
  onEditOne,
  onDeleteOne,
  onEditFollowing,
  onDeleteFollowing,
}: EventDialogProps) {
  return (
    <Dialog open={draft !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {draft ? (
          <EventForm
            key={
              draft.id ??
              draft.detachFrom?.startsAt ??
              (draft.splitFrom
                ? `following-${draft.splitFrom.startsAt}`
                : "new")
            }
            draft={draft}
            readOnly={readOnly}
            createdBy={createdBy}
            onClose={onClose}
            onSave={onSave}
            onDelete={onDelete}
            onEditOne={onEditOne}
            onDeleteOne={onDeleteOne}
            onEditFollowing={onEditFollowing}
            onDeleteFollowing={onDeleteFollowing}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
