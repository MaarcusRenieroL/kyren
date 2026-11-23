import { Input } from "@zentro/ui/shadcn/input";
import { Label } from "@zentro/ui/shadcn/label";
import type { FC } from "react";
import { CalendarIcon, SearchIcon } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@zentro/ui/shadcn/select";
import { allValue, chip, prefixes } from "./types";

type AuditFilterBarProps = {
  search: string;
  onSearchChange: (value: string) => void;
  actor: string;
  onActorChange: (value: string) => void;
  actors: Array<{ id: string; label: string }>;
  prefix: string;
  onPrefixChange: (value: string) => void;
  from: string;
  onFromChange: (value: string) => void;
  to: string;
  onToChange: (value: string) => void;
  eventsCountText: string;
};

export const AuditFilterBar: FC<AuditFilterBarProps> = ({
  search,
  onSearchChange,
  actor,
  onActorChange,
  actors,
  prefix,
  onPrefixChange,
  from,
  onFromChange,
  to,
  onToChange,
  eventsCountText,
}) => {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative h-8 w-full sm:w-60">
        <SearchIcon
          aria-hidden="true"
          className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-ink-3"
        />
        <Input
          id="audit-search"
          aria-label="Search"
          value={search}
          placeholder="Search events"
          onChange={(event) => onSearchChange(event.target.value)}
          className="h-full w-full rounded-xl border border-hairline bg-surface pr-2.5 pl-8 text-[13px] outline-none placeholder:text-ink-3 focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/22"
        />
      </div>

      <Select value={actor} onValueChange={onActorChange}>
        <SelectTrigger aria-label="Actor" className={chip}>
          <span className="text-ink-3">Actor</span>
          <SelectValue>
            {actor === allValue ? null : (
              <span className="font-medium text-ink">
                {actors.find((item) => item.id === actor)?.label}
              </span>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={allValue}>Anyone</SelectItem>
          {actors.map((item) => (
            <SelectItem key={item.id} value={item.id}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={prefix} onValueChange={onPrefixChange}>
        <SelectTrigger aria-label="Action" className={chip}>
          <span className="text-ink-3">Action</span>
          <SelectValue>
            {prefix === allValue ? null : (
              <span className="font-medium text-ink">{prefix}*</span>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={allValue}>All actions</SelectItem>
          {prefixes.map((item) => (
            <SelectItem key={item} value={item}>
              {item}*
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Label className="flex h-8 items-center gap-1.5 rounded-xl border border-hairline px-2.5 text-[13px]">
        <CalendarIcon className="size-3.5 text-ink-3" aria-hidden="true" />
        <span className="text-ink-3">From</span>
        <Input
          id="audit-from"
          type="date"
          aria-label="From"
          value={from}
          onChange={(event) => onFromChange(event.target.value)}
          className="bg-transparent font-mono text-xs outline-none"
        />
      </Label>
      <Label className="flex h-8 items-center gap-1.5 rounded-xl border border-hairline px-2.5 text-[13px]">
        <span className="text-ink-3">To</span>
        <Input
          id="audit-to"
          type="date"
          aria-label="To"
          value={to}
          onChange={(event) => onToChange(event.target.value)}
          className="bg-transparent font-mono text-xs outline-none"
        />
      </Label>

      <span className="font-mono text-xs text-ink-3">{eventsCountText}</span>
      <span className="flex-1" />
      <span className="font-mono text-xs text-ink-3">Every event is kept</span>
    </div>
  );
};
