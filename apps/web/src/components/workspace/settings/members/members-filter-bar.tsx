"use client";

import { Label } from "@kyren/ui/shadcn/label";
import { SearchIcon } from "lucide-react";
import { Input } from "@kyren/ui/components/shadcn/input";

import { FilterSelect } from "./members-helpers";

export function MembersFilterBar({
  query,
  setQuery,
  roleFilter,
  setRoleFilter,
  teamFilter,
  setTeamFilter,
  teamNames,
  filteredCount,
}: {
  query: string;
  setQuery: (q: string) => void;
  roleFilter: string;
  setRoleFilter: (r: string) => void;
  teamFilter: string;
  setTeamFilter: (t: string) => void;
  teamNames: string[];
  filteredCount: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Label className="relative w-full sm:w-60">
        <span className="sr-only">Search name or email</span>
        <SearchIcon
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3"
        />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name or email"
          className="h-8 rounded-md bg-surface pl-9 text-[13px]"
        />
      </Label>
      <FilterSelect
        label="Role"
        value={roleFilter}
        onChange={setRoleFilter}
        options={[
          { value: "owner", label: "Owner" },
          { value: "admin", label: "Admin" },
          { value: "member", label: "Member" },
        ]}
      />
      <FilterSelect
        label="Team"
        value={teamFilter}
        onChange={setTeamFilter}
        options={[
          ...teamNames.map((name) => ({ value: name, label: name })),
          { value: "none", label: "No team" },
        ]}
      />
      <span className="font-mono text-xs text-ink-3">
        {filteredCount} {filteredCount === 1 ? "member" : "members"}
      </span>
    </div>
  );
}
