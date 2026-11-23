import type { FC } from "react";
import { PlusIcon, XIcon } from "lucide-react";
import { Button } from "@kyren/ui/shadcn/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@kyren/ui/shadcn/select";
import { ActorAvatar } from "~/src/components/actor-avatar";
import { field, type Access, type Option } from "./types";

type AssignmentsListProps = {
  access: Access;
  canAssign: boolean;
  adding: boolean;
  onToggleAdding: () => void;
  principal: string;
  onPrincipalChange: (value: string) => void;
  roleId: string;
  onRoleIdChange: (value: string) => void;
  people: Option[];
  teamOptions: Option[];
  onAssign: () => Promise<void>;
  onUnassign: (id: string) => Promise<void>;
  onChangeRole: (
    assignment: Access["assignments"][number],
    roleId: string,
  ) => Promise<void>;
};

export const AssignmentsList: FC<AssignmentsListProps> = ({
  access,
  canAssign,
  adding,
  onToggleAdding,
  principal,
  onPrincipalChange,
  roleId,
  onRoleIdChange,
  people,
  teamOptions,
  onAssign,
  onUnassign,
  onChangeRole,
}) => {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-2.5">
        <h2 className="text-[15px] font-semibold">People</h2>
        <span className="font-mono text-xs text-ink-2">
          {access.assignments.length}
        </span>
        <span className="flex-1" />
        {canAssign ? (
          <Button
            onClick={onToggleAdding}
            aria-expanded={adding}
            className="h-9 px-3 font-semibold"
          >
            <PlusIcon />
            Add people
          </Button>
        ) : null}
      </div>

      {adding && canAssign ? (
        <div className="grid gap-2.5 rounded-xl border border-hairline bg-surface p-3 md:grid-cols-[1fr_200px_auto]">
          <Select value={principal} onValueChange={onPrincipalChange}>
            <SelectTrigger aria-label="Person or team" className={field}>
              <SelectValue placeholder="Person or team" />
            </SelectTrigger>
            <SelectContent>
              {people.map((person) => (
                <SelectItem key={person.id} value={person.id}>
                  {person.label}
                </SelectItem>
              ))}
              {teamOptions.map((team) => (
                <SelectItem key={team.id} value={`team:${team.id}`}>
                  Team: {team.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={roleId} onValueChange={onRoleIdChange}>
            <SelectTrigger aria-label="Project role" className={field}>
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              {access.availableRoles.map((role) => (
                <SelectItem key={role.id} value={role.id}>
                  {role.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            disabled={!principal || !roleId}
            onClick={onAssign}
            className="h-11 px-4"
          >
            Add
          </Button>
        </div>
      ) : null}

      {access.assignments.length ? (
        <ul className="flex flex-col">
          {access.assignments.map((assignment) => (
            <li
              key={assignment.id}
              className="flex min-h-14 items-center gap-3 border-t border-hairline/70 px-2 py-2"
            >
              {assignment.principalType === "user" ? (
                <ActorAvatar name={assignment.principalName} size={30} />
              ) : (
                <span
                  aria-hidden="true"
                  className="flex size-[30px] items-center justify-center rounded-sm border border-hairline bg-tint-teams font-mono text-[11px]"
                >
                  {assignment.principalName.charAt(0).toUpperCase()}
                </span>
              )}
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium">
                  {assignment.principalName}
                </span>
                <span className="font-mono text-[11px] text-ink-3">
                  {assignment.principalType === "team"
                    ? "Everyone on this team"
                    : "Person"}
                </span>
              </span>
              <span className="hidden text-[13px] text-ink-3 sm:block">
                {assignment.principalType === "team"
                  ? "Via team"
                  : "Added directly"}
              </span>
              {canAssign ? (
                <Select
                  value={assignment.roleId}
                  onValueChange={(value) =>
                    value && void onChangeRole(assignment, value)
                  }
                >
                  <SelectTrigger
                    aria-label={`Role for ${assignment.principalName}`}
                    className="h-8 w-[150px] rounded-md border-hairline bg-transparent text-[13px] shadow-none data-[size=default]:h-8"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {access.availableRoles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <span className="rounded-sm border border-hairline px-2 py-0.5 text-[13px]">
                  {assignment.roleName}
                </span>
              )}
              {canAssign ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-8 text-ink-3"
                  aria-label={`Remove ${assignment.principalName}`}
                  onClick={() => onUnassign(assignment.id)}
                >
                  <XIcon className="size-3.5" />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-line-strong px-4 py-8 text-center text-sm text-ink-3">
          No one has a role on this project alone yet. Organization roles still
          apply.
        </p>
      )}
      <p className="pt-1 text-[13px] text-ink-3">
        Organization owners and admins can always open this project.
      </p>
    </section>
  );
};
