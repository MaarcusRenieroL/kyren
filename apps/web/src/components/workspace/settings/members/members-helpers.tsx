"use client";

import type { FC } from "react";
import { cn } from "@zentro/ui/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@zentro/ui/components/shadcn/select";
import type { Member } from "~/src/lib/types";

export type Role = "owner" | "admin" | "member";

export const PAGE_SIZE = 10;

export const teamDots = [
  "bg-tint-tasks",
  "bg-tint-projects",
  "bg-tint-docs",
  "bg-tint-teams",
  "bg-tint-audit",
] as const;

export function dotFor(name: string) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return teamDots[hash % teamDots.length];
}

export function formatRole(role: Role) {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

/** "Active now", "12m ago", "2h ago", "Yesterday" or a short date. */
export function shortAgo(iso: string | null) {
  if (!iso) return "Never";

  const at = new Date(iso);
  const minutes = Math.round((Date.now() - at.getTime()) / 60_000);

  if (minutes < 5) return "Active now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 24 * 60) return `${Math.round(minutes / 60)}h ago`;
  if (minutes < 48 * 60) return "Yesterday";
  if (minutes < 7 * 24 * 60) return `${Math.round(minutes / 1440)}d ago`;

  return at.toLocaleDateString("en", { month: "short", day: "numeric" });
}

export function monthYear(date: Date) {
  return new Date(date).toLocaleDateString("en", {
    month: "short",
    year: "numeric",
  });
}

/** A small bordered select used as a table filter. */
export function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <Select
      value={value}
      onValueChange={(next) => {
        if (next !== "") onChange(next);
      }}
    >
      <SelectTrigger
        size="sm"
        aria-label={label}
        className="h-8 w-auto gap-1.5 rounded-md bg-surface px-2.5 text-[13px] data-[size=sm]:h-8"
      >
        {value === "all" ? label : <SelectValue />}
      </SelectTrigger>
      <SelectContent align="start">
        <SelectItem value="all">All</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const pill =
  "inline-flex h-7 items-center gap-1 rounded-sm border border-hairline px-2.5 text-[13px]";

export type RoleControlProps = {
  disabled: boolean;
  isCurrentUser: boolean;
  member: Member;
  onRoleChange: (memberId: string, role: Role) => void;
};

export const RoleControl: FC<RoleControlProps> = ({
  disabled,
  isCurrentUser,
  member,
  onRoleChange,
}) => {
  if (isCurrentUser || member.role === "owner" || disabled) {
    return (
      <span
        className={cn(
          pill,
          member.role === "owner" ? "bg-hover" : "bg-surface",
        )}
      >
        {formatRole(member.role)}
      </span>
    );
  }

  return (
    <Select
      value={member.role}
      onValueChange={(value) => {
        if (value === "") return;
        onRoleChange(member.id, value as Role);
      }}
    >
      <SelectTrigger
        size="sm"
        aria-label={`Role for ${member.user.name}`}
        className={cn(pill, "w-auto bg-surface shadow-none data-[size=sm]:h-7")}
      >
        <SelectValue />
      </SelectTrigger>

      <SelectContent>
        <SelectItem value="admin">Admin</SelectItem>
        <SelectItem value="member">Member</SelectItem>
      </SelectContent>
    </Select>
  );
};
