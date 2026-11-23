import type { FC } from "react";
import Link from "next/link";
import { CopyIcon, LockIcon, MoreHorizontalIcon, Trash2Icon } from "lucide-react";
import { Button } from "@kyren/ui/shadcn/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@kyren/ui/shadcn/dropdown-menu";
import { ActorAvatar } from "~/src/components/actor-avatar";
import { paths } from "~/src/lib/paths";
import { scopeLabels } from "../use-catalog";
import type { RoleRow } from "./types";

type RolesTableRowProps = {
  role: RoleRow;
  people: Array<{ userId: string; name: string; role: string }> | null;
  total: number;
  granted: number;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  onStartClone: (role: RoleRow) => void;
  onStartDelete: (role: RoleRow) => void;
};

export const RolesTableRow: FC<RolesTableRowProps> = ({
  role,
  people,
  total,
  granted,
  canCreate,
  canUpdate,
  canDelete,
  onStartClone,
  onStartDelete,
}) => {
  const count = people ? people.length : role.assignmentCount;
  const canClone = canCreate;
  const canRemove = canDelete && role.kind === "custom";

  return (
    <div
      role="row"
      data-testid={`role-row-${role.name}`}
      className="relative flex min-h-[63px] items-center gap-3 border-b border-hairline/60 px-3 py-2 hover:bg-hover"
    >
      <span role="cell" className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-2">
          <Link
            href={paths.role(role.id)}
            className="text-[15px] font-medium outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-ring"
          >
            {role.name}
          </Link>
          <span className="inline-flex items-center gap-1 rounded-xs border border-hairline px-1.5 font-mono text-[10px] tracking-[0.04em] text-ink-2 uppercase">
            {role.kind === "system" ? (
              <LockIcon className="size-2.5" aria-hidden="true" />
            ) : null}
            {role.kind === "system" ? "System" : "Custom"}
          </span>
          {role.scope !== "organization" ? (
            <span className="font-mono text-[11px] text-ink-3">
              {scopeLabels[role.scope] ?? role.scope} role
            </span>
          ) : null}
        </span>
        {role.description ? (
          <span className="text-sm text-ink-2">{role.description}</span>
        ) : null}
      </span>
      <span role="cell" className="hidden w-36 items-center gap-2 sm:flex">
        {people?.length ? (
          <span className="flex">
            {people.slice(0, 3).map((member) => (
              <span
                key={member.userId}
                title={member.name}
                className="-ml-1.5 rounded-full ring-2 ring-canvas first:ml-0"
              >
                <ActorAvatar name={member.name} size={22} />
              </span>
            ))}
          </span>
        ) : null}
        <span className="font-mono text-xs text-ink-2">{count}</span>
      </span>
      <span
        role="cell"
        className="w-24 text-right font-mono text-sm text-ink-2"
      >
        {granted} / {total}
      </span>
      <span role="cell" className="relative z-[1] flex w-8 justify-end">
        {canClone || canRemove ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Actions for ${role.name}`}
              >
                <MoreHorizontalIcon className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem asChild>
                <Link href={paths.role(role.id)}>
                  {role.editable && canUpdate ? "Edit" : "View"}
                </Link>
              </DropdownMenuItem>
              {canClone ? (
                <DropdownMenuItem onClick={() => onStartClone(role)}>
                  <CopyIcon className="size-4" />
                  Clone {role.name}
                </DropdownMenuItem>
              ) : null}
              {canRemove ? (
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => onStartDelete(role)}
                >
                  <Trash2Icon className="size-4" />
                  Delete {role.name}
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </span>
    </div>
  );
};
