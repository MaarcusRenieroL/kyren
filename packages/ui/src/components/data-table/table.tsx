"use client";

import {
  type ColumnFiltersState,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { type ReactElement, useMemo, useState } from "react";
import { Checkbox } from "../shadcn/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../shadcn/table";
import { cn } from "../../lib/utils";
import { DataTablePagination } from "./pagination";
import { DataTableToolbar } from "./toolbar";
import {
  type DataTableColumnDef,
  type DataTableProps,
  getColumnClassName,
} from "./types";

export function DataTable<TData, TValue>({
  columns,
  data,
  emptyMessage = "No results found.",
  filterPlaceholder = "Search...",
  getRowId,
  globalFilterFn,
  initialPageSize = 10,
  renderBulkActions,
  searchColumn,
  showColumnVisibility = true,
  showPagination = true,
  showRowSelection = true,
  toolbarActions,
}: DataTableProps<TData, TValue>): ReactElement {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [globalFilter, setGlobalFilter] = useState("");
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: initialPageSize,
  });

  const tableColumns = useMemo<DataTableColumnDef<TData, TValue>[]>(() => {
    if (!showRowSelection) return columns;

    return [
      {
        id: "_select",
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
            onCheckedChange={(value) =>
              table.toggleAllPageRowsSelected(Boolean(value))
            }
            aria-label="Select all rows"
            className="translate-y-0.5"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(Boolean(value))}
            aria-label="Select row"
            className="translate-y-0.5"
          />
        ),
        enableSorting: false,
        enableHiding: false,
        meta: {
          className: "w-10 px-3",
        },
      },
      ...columns,
    ];
  }, [columns, showRowSelection]);

  const table = useReactTable({
    data,
    columns: tableColumns,
    state: {
      columnFilters,
      columnVisibility,
      globalFilter,
      pagination,
      rowSelection,
      sorting,
    },
    enableRowSelection: showRowSelection,
    getRowId,
    globalFilterFn,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  const selectedRows = table.getSelectedRowModel().rows;
  const searchValue = searchColumn
    ? ((table.getColumn(searchColumn)?.getFilterValue() as string) ?? "")
    : globalFilter;

  const hasFilters =
    columnFilters.length > 0 || Boolean(globalFilter) || Boolean(searchValue);

  const handleSearchChange = (value: string) => {
    if (searchColumn) {
      table.getColumn(searchColumn)?.setFilterValue(value);
      return;
    }
    setGlobalFilter(value);
  };

  const resetFilters = () => {
    setColumnFilters([]);
    setGlobalFilter("");
  };

  return (
    <div className="space-y-4">
      <DataTableToolbar
        table={table}
        searchValue={searchValue}
        onSearchChange={handleSearchChange}
        filterPlaceholder={filterPlaceholder}
        hasFilters={hasFilters}
        onResetFilters={resetFilters}
        selectedRows={selectedRows}
        renderBulkActions={renderBulkActions}
        toolbarActions={toolbarActions}
        showColumnVisibility={showColumnVisibility}
      />

      <div className="tile overflow-x-auto">
        <Table className="min-w-[720px]">
          <TableHeader className="bg-secondary/50">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={cn(
                      header.column.getCanSort() &&
                        "cursor-pointer select-none",
                      getColumnClassName(header.column.columnDef),
                    )}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                    {{
                      asc: " ↑",
                      desc: " ↓",
                    }[header.column.getIsSorted() as string] ?? null}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() ? "selected" : undefined}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={getColumnClassName(cell.column.columnDef)}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={table.getVisibleLeafColumns().length}
                  className="h-28 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {showPagination ? (
        <DataTablePagination table={table} selectedRows={selectedRows} />
      ) : null}
    </div>
  );
}
