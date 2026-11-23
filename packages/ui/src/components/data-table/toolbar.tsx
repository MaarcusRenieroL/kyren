"use client";

import type { Table as TableInstance, Row } from "@tanstack/react-table";
import {
  ChevronDownIcon,
  ListFilterIcon,
  SearchIcon,
  SlidersHorizontalIcon,
  XIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "../shadcn/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../shadcn/dropdown-menu";
import { Input } from "../shadcn/input";
import { getColumnLabel } from "./types";

type DataTableToolbarProps<TData> = {
  table: TableInstance<TData>;
  searchValue: string;
  onSearchChange: (value: string) => void;
  filterPlaceholder: string;
  hasFilters: boolean;
  onResetFilters: () => void;
  selectedRows: Row<TData>[];
  renderBulkActions?: (selectedRows: Row<TData>[]) => ReactNode;
  toolbarActions?: ReactNode;
  showColumnVisibility: boolean;
};

export function DataTableToolbar<TData>({
  table,
  searchValue,
  onSearchChange,
  filterPlaceholder,
  hasFilters,
  onResetFilters,
  selectedRows,
  renderBulkActions,
  toolbarActions,
  showColumnVisibility,
}: DataTableToolbarProps<TData>) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-sm">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={filterPlaceholder}
            className="pl-9"
          />
        </div>

        {hasFilters ? (
          <Button variant="ghost" size="sm" onClick={onResetFilters}>
            <XIcon className="size-4" />
            Reset
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        {selectedRows.length > 0 && renderBulkActions ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {selectedRows.length} selected
            </span>
            {renderBulkActions(selectedRows)}
          </div>
        ) : null}

        {toolbarActions}

        {showColumnVisibility ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <SlidersHorizontalIcon className="size-4" />
                Columns
                <ChevronDownIcon className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel className="flex items-center gap-2">
                <ListFilterIcon className="size-3.5" />
                Toggle columns
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {table
                .getAllLeafColumns()
                .filter(
                  (column) => column.getCanHide() && column.id !== "_select",
                )
                .map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) =>
                      column.toggleVisibility(Boolean(value))
                    }
                  >
                    {getColumnLabel(column.columnDef)}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </div>
  );
}
