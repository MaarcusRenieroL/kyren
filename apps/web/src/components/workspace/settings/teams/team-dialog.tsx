"use client";

import { useMemo } from "react";
import { TeamRolesPanel } from "~/src/components/workspace/roles/team-roles-panel";
import { usePermission } from "~/src/components/permissions/permission-provider";
import { ActorAvatar } from "~/src/components/actor-avatar";
import { cn } from "@zentro/ui";
import { Badge } from "@zentro/ui/components/shadcn/badge";
import { Button } from "@zentro/ui/components/shadcn/button";
import { Checkbox } from "@zentro/ui/components/shadcn/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@zentro/ui/components/shadcn/dialog";
import { Input } from "@zentro/ui/components/shadcn/input";
import { Label } from "@zentro/ui/components/shadcn/label";
import { Textarea } from "@zentro/ui/components/shadcn/textarea";
import {
  formatRole,
  sortMembers,
  teamColors,
  type AvailableMember,
  type TeamFormState,
} from "./teams-types";

export type TeamDialogProps = {
  availableMembers: AvailableMember[];
  form: TeamFormState;
  mode: "create" | "edit";
  open: boolean;
  saving: boolean;
  teamId: string | null;
  onChange: (form: TeamFormState) => void;
  onOpenChange: (open: boolean) => void;
  /** What the person may change, so only that is saved. */
  onSubmit: (changes: { details: boolean; members: boolean }) => void;
};

export function TeamDialog({
  availableMembers,
  form,
  mode,
  open,
  saving,
  teamId,
  onChange,
  onOpenChange,
  onSubmit,
}: TeamDialogProps) {
  const sortedMembers = useMemo(
    () => sortMembers(availableMembers),
    [availableMembers],
  );

  // Rights on this team: a team lead holds them for their own team only.
  const scope = mode === "edit" && teamId ? { teamId } : undefined;
  const canViewRoles = usePermission("roles.view");
  const canManageMembers = usePermission("teams.members.manage", scope);
  const canUpdateTeam = usePermission("teams.update", scope);
  const canEditDetails = mode === "create" || canUpdateTeam;

  function toggleMember(memberId: string) {
    if (!canManageMembers) return;

    onChange({
      ...form,
      memberIds: form.memberIds.includes(memberId)
        ? form.memberIds.filter((id) => id !== memberId)
        : [...form.memberIds, memberId],
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Create team" : "Edit team"}
          </DialogTitle>
          <DialogDescription>
            Group workspace members so projects, ownership, and planning can
            stay easier to scan.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5">
          <div className="grid gap-2">
            <Label htmlFor="team-name">Name</Label>
            <Input
              id="team-name"
              disabled={!canEditDetails}
              value={form.name}
              placeholder="Design"
              onChange={(event) =>
                onChange({ ...form, name: event.target.value })
              }
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="team-description">Description</Label>
            <Textarea
              id="team-description"
              disabled={!canEditDetails}
              className="min-h-24 resize-none"
              value={form.description}
              placeholder="What does this team own?"
              onChange={(event) =>
                onChange({ ...form, description: event.target.value })
              }
            />
          </div>

          <div className="grid gap-2">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {teamColors.map((teamColor) => (
                <Button
                  variant="custom"
                  key={teamColor.value}
                  type="button"
                  disabled={!canEditDetails}
                  className={cn(
                    "flex h-8 items-center gap-2 rounded-md border px-2.5 text-sm transition-colors hover:bg-muted",
                    form.color === teamColor.value && "border-foreground",
                  )}
                  onClick={() => onChange({ ...form, color: teamColor.value })}
                >
                  <span
                    className={cn("size-3 rounded-full", teamColor.className)}
                  />
                  {teamColor.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-3">
              <Label>Members</Label>
              <Badge variant="secondary">
                {form.memberIds.length} selected
              </Badge>
            </div>
            <div className="max-h-72 overflow-y-auto rounded-lg border">
              {sortedMembers.map((member) => {
                const checked = form.memberIds.includes(member.id);

                return (
                  <div
                    key={member.id}
                    className="flex w-full items-center gap-3 border-b px-3 py-3 text-left last:border-b-0 hover:bg-muted/40"
                  >
                    <Checkbox
                      aria-label={member.name}
                      checked={checked}
                      disabled={!canManageMembers}
                      onCheckedChange={() => toggleMember(member.id)}
                    />
                    <ActorAvatar name={member.name} size={32} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {member.name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {member.email}
                      </p>
                    </div>
                    <Badge variant="outline">{formatRole(member.role)}</Badge>
                  </div>
                );
              })}
            </div>
            {!canManageMembers ? (
              <p className="text-xs text-muted-foreground">
                You can edit team details, but only admins and owners can manage
                team membership.
              </p>
            ) : null}
          </div>
          {mode === "edit" && teamId && (canViewRoles || canManageMembers) ? (
            <TeamRolesPanel
              teamId={teamId}
              members={sortedMembers
                .filter((member) => form.memberIds.includes(member.id))
                .map((member) => ({
                  userId: member.userId,
                  name: member.name ?? member.email,
                }))}
            />
          ) : null}
        </div>

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={saving || form.name.trim().length < 2}
            onClick={() =>
              onSubmit({
                details: canEditDetails,
                members: mode === "create" || canManageMembers,
              })
            }
          >
            {saving
              ? mode === "create"
                ? "Creating..."
                : "Saving..."
              : mode === "create"
                ? "Create team"
                : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
