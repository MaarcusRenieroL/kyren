import type { FC } from "react";
import { Button } from "@zentro/ui/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@zentro/ui/shadcn/dialog";
import { Input } from "@zentro/ui/shadcn/input";
import { Label } from "@zentro/ui/shadcn/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@zentro/ui/shadcn/select";
import type { RoleRow } from "./types";

type CreateRoleDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  onNameChange: (value: string) => void;
  scope: "organization" | "team" | "project";
  onScopeChange: (scope: "organization" | "team" | "project") => void;
  onCreate: () => Promise<void>;
};

export const CreateRoleDialog: FC<CreateRoleDialogProps> = ({
  open,
  onOpenChange,
  name,
  onNameChange,
  scope,
  onScopeChange,
  onCreate,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New role</DialogTitle>
          <DialogDescription>
            Name the role and choose where it can be assigned. You pick its
            permissions next.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="role-name">Name</Label>
            <Input
              id="role-name"
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              placeholder="Viewer plus comment"
            />
          </div>
          <div className="space-y-2">
            <Label>Scope</Label>
            <Select
              value={scope}
              onValueChange={(value) =>
                onScopeChange(value as "organization" | "team" | "project")
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="organization">Organization</SelectItem>
                <SelectItem value="team">Team</SelectItem>
                <SelectItem value="project">Project</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={name.trim().length < 2} onClick={onCreate}>
            Create role
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

type CloneRoleDialogProps = {
  cloning: RoleRow | null;
  onClose: () => void;
  name: string;
  onNameChange: (value: string) => void;
  onClone: () => Promise<void>;
};

export const CloneRoleDialog: FC<CloneRoleDialogProps> = ({
  cloning,
  onClose,
  name,
  onNameChange,
  onClone,
}) => {
  return (
    <Dialog open={Boolean(cloning)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Clone {cloning?.name}</DialogTitle>
          <DialogDescription>
            The copy starts with the same permissions (owner-only ones are left
            out).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="clone-name">Name</Label>
          <Input
            id="clone-name"
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={name.trim().length < 2} onClick={onClone}>
            Clone role
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

type DeleteRoleDialogProps = {
  deleting: RoleRow | null;
  onClose: () => void;
  onDelete: () => Promise<void>;
};

export const DeleteRoleDialog: FC<DeleteRoleDialogProps> = ({
  deleting,
  onClose,
  onDelete,
}) => {
  return (
    <Dialog
      open={Boolean(deleting)}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {deleting?.name}?</DialogTitle>
          <DialogDescription>
            {deleting && deleting.assignmentCount > 0
              ? `This role is assigned ${deleting.assignmentCount} time${deleting.assignmentCount === 1 ? "" : "s"}. Remove those assignments first.`
              : "This cannot be undone."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={Boolean(deleting && deleting.assignmentCount > 0)}
            onClick={onDelete}
          >
            Delete role
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
