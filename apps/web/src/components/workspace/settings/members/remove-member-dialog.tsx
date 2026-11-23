"use client";

import type { FC } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@kyren/ui/components/shadcn/alert-dialog";
import type { Member } from "~/src/lib/types";

type RemoveMemberDialogProps = {
  member: Member | null;
  onClose: () => void;
  onConfirm: () => void;
};

export const RemoveMemberDialog: FC<RemoveMemberDialogProps> = ({
  member,
  onClose,
  onConfirm,
}) => {
  return (
    <AlertDialog
      open={Boolean(member)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove member?</AlertDialogTitle>
          <AlertDialogDescription>
            {member?.user.name} will lose access to this organization and its
            workspace apps.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={onConfirm}
          >
            Remove member
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
