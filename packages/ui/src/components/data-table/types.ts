import type { ColumnDef, Row } from "@tanstack/react-table";
import type { ReactNode } from "react";

export type DataTableColumnDef<TData, TValue = unknown> = ColumnDef<
  TData,
  TValue
> & {
  meta?: {
    label?: string;
    className?: string;
  };
};

export type DataTableProps<TData, TValue> = {
  columns: DataTableColumnDef<TData, TValue>[];
  data: TData[];
  emptyMessage?: string;
  filterPlaceholder?: string;
  getRowId?: (row: TData, index: number) => string;
  globalFilterFn?: (
    row: Row<TData>,
    columnId: string,
    value: string,
  ) => boolean;
  initialPageSize?: number;
  renderBulkActions?: (selectedRows: Row<TData>[]) => ReactNode;
  searchColumn?: keyof TData & string;
  showColumnVisibility?: boolean;
  showPagination?: boolean;
  showRowSelection?: boolean;
  toolbarActions?: ReactNode;
};

export function getColumnLabel<TData, TValue>(
  column: DataTableColumnDef<TData, TValue>,
) {
  return column.meta?.label ?? String(column.id ?? "");
}

export function getColumnClassName<TData, TValue>(
  column: ColumnDef<TData, TValue>,
) {
  return (column as DataTableColumnDef<TData, TValue>).meta?.className;
}
