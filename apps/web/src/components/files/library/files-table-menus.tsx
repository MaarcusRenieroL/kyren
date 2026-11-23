"use client";

import { ArrowDownUpIcon, SlidersHorizontalIcon } from "lucide-react";
import { Button } from "@zentro/ui/shadcn/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@zentro/ui/shadcn/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@zentro/ui/shadcn/select";
import { fileColumns, kinds, type FileSort, type Kind } from "./types";

export function FileTypeFilter({
  kind,
  onChange,
}: {
  kind: Kind;
  onChange: (kind: Kind) => void;
}) {
  return (
    <Select
      value={kind}
      onValueChange={(value) => {
        const option = kinds.find((item) => item.id === value);
        if (option) onChange(option.id);
      }}
    >
      <SelectTrigger aria-label="File type" className="h-8 w-auto min-w-28">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {kinds.map(({ id, label }) => (
          <SelectItem key={id} value={id}>
            {id === "all" ? "All file types" : label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function FilesTableMenus({
  sort,
  onSort,
  columnVisibility,
  onColumnVisibility,
}: {
  sort: FileSort;
  onSort: (sort: FileSort) => void;
  columnVisibility: Record<string, boolean>;
  onColumnVisibility: (column: string, visible: boolean) => void;
}) {
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline">
            <ArrowDownUpIcon aria-hidden />
            Sort
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuRadioGroup
            value={sort.column}
            onValueChange={(value) => {
              const column = fileColumns.find((item) => item.id === value);
              if (column) onSort({ ...sort, column: column.id });
            }}
          >
            {fileColumns.map(({ id, label }) => (
              <DropdownMenuRadioItem key={id} value={id}>
                {label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup
            value={sort.descending ? "desc" : "asc"}
            onValueChange={(direction) =>
              onSort({ ...sort, descending: direction === "desc" })
            }
          >
            <DropdownMenuRadioItem value="asc">Ascending</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="desc">
              Descending
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline" aria-label="View columns">
            <SlidersHorizontalIcon aria-hidden />
            Columns
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          {fileColumns
            .filter(({ id }) => id !== "name")
            .map(({ id, label }) => (
              <DropdownMenuCheckboxItem
                key={id}
                checked={columnVisibility[id] !== false}
                onCheckedChange={(visible) => onColumnVisibility(id, visible)}
                onSelect={(event) => event.preventDefault()}
              >
                {label}
              </DropdownMenuCheckboxItem>
            ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
