import { useMemo, useState } from "react";
import { CheckIcon, SearchIcon } from "lucide-react";
import { cn } from "@kyren/ui/lib/utils";
import { Button } from "@kyren/ui/shadcn/button";
import { Input } from "@kyren/ui/shadcn/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@kyren/ui/shadcn/popover";
import { AvatarInitials } from "../avatar-initials";
import type { MemberOption } from "../types";

type AssigneePickerProps = {
  members: MemberOption[];
  value: string | null;
  disabled: boolean;
  onChange: (value: string | null) => void;
};

export function AssigneePicker({
  members,
  value,
  disabled,
  onChange,
}: AssigneePickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selectedMember = value
    ? members.find((member) => member.id === value)
    : null;

  const filteredMembers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return members;
    }

    return members.filter((member) =>
      [member.name, member.email]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [members, query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          disabled={disabled}
          className="-ml-1.5 h-8 w-[calc(100%+0.375rem)] justify-start gap-2.5 px-1.5 text-sm font-normal text-ink hover:bg-hover disabled:opacity-100"
        >
          {selectedMember ? (
            <>
              <AvatarInitials
                value={selectedMember.name ?? selectedMember.email}
              />
              <span className="truncate">
                {selectedMember.name ?? selectedMember.email}
              </span>
            </>
          ) : (
            <>
              <span
                aria-hidden="true"
                className="size-6 rounded-full border-[1.5px] border-dashed border-line-strong"
              />
              <span className="text-ink-3">Unassigned</span>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[--radix-popover-trigger-width] min-w-72 p-2"
      >
        <div className="relative">
          <SearchIcon className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search members"
            className="h-9 pl-8"
          />
        </div>

        <div className="mt-2 max-h-72 overflow-y-auto">
          <Button
            variant="custom"
            type="button"
            className="flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-muted"
            onClick={() => {
              onChange(null);
              setOpen(false);
              setQuery("");
            }}
          >
            <span
              aria-hidden="true"
              className="size-6 rounded-full border-[1.5px] border-dashed border-line-strong"
            />
            <span className="min-w-0 flex-1 truncate">Unassigned</span>
            {!value ? <CheckIcon className="size-4 text-primary" /> : null}
          </Button>

          {filteredMembers.map((member) => {
            const label = member.name ?? member.email;
            const isSelected = member.id === value;

            return (
              <Button
                variant="custom"
                type="button"
                key={member.id}
                className={cn(
                  "flex h-10 w-full items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-muted",
                  isSelected && "bg-muted",
                )}
                onClick={() => {
                  onChange(member.id);
                  setOpen(false);
                  setQuery("");
                }}
              >
                <AvatarInitials value={label} />
                <span className="min-w-0 flex-1 truncate">{label}</span>
                {isSelected ? (
                  <CheckIcon className="size-4 text-primary" />
                ) : null}
              </Button>
            );
          })}

          {!filteredMembers.length ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              No members found.
            </p>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
