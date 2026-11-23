"use client";

import {
  Dialog,
  DialogContent,
} from "@kyren/ui/shadcn/dialog";
import type { ComposeDraft, Person, Attachment } from "./compose/types";
import { ComposeForm } from "./compose/compose-form";

export type { Person, ComposeDraft, Attachment };

type Props = {
  draft: ComposeDraft | null;
  people: Person[];
  onSend: (draft: ComposeDraft) => Promise<void>;
  /** Called when the window closes with something typed in it. */
  onKeep: (draft: ComposeDraft) => Promise<void>;
  onDiscard: () => void;
};

export function ComposeDialog(props: Props) {
  const { draft } = props;

  // Only the buttons close it, so nothing typed is lost by a stray click.
  return (
    <Dialog open={draft !== null}>
      <DialogContent
        className="sm:max-w-2xl"
        showCloseButton={false}
        onEscapeKeyDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        {draft ? (
          <ComposeForm key={draft.id ?? "new"} {...props} draft={draft} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
