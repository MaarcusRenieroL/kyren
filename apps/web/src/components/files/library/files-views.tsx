"use client";

import type { FC } from "react";
import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { ArrowDownIcon, ArrowUpIcon, ArrowUpDownIcon } from "lucide-react";
import { Button } from "@kyren/ui/shadcn/button";
import type { FileSort, Folder, LibraryFile } from "./types";
import { formatSize, dateFormat } from "./types";
import { FileThumb } from "./file-thumb";
import { FileActions, FileName } from "./file-actions";
import { DataTable } from "./tablecn-data-table";

type FilesViewProps = {
  files: LibraryFile[];
  folders: Folder[];
  renaming: string | null;
  draft: string;
  onDraftChange: (value: string) => void;
  onStartRename: (file: LibraryFile) => void;
  onSaveRename: (file: LibraryFile) => void;
  onCancelRename: () => void;
  onMove: (file: LibraryFile, target: string) => void;
  onRemove: (file: LibraryFile) => void;
};

type FilesTableProps = FilesViewProps & {
  sort: FileSort;
  columnVisibility: Record<string, boolean>;
  emptyMessage: string;
  onSort: (next: FileSort) => void;
};

export function FilesTableView({
  files,
  folders,
  renaming,
  draft,
  onDraftChange,
  onStartRename,
  onSaveRename,
  onCancelRename,
  onMove,
  onRemove,
  sort,
  columnVisibility,
  emptyMessage,
  onSort,
}: FilesTableProps) {
  function sortableHeader(column: FileSort["column"], label: string) {
    const sorted = sort.column === column;
    const Icon = !sorted
      ? ArrowUpDownIcon
      : sort.descending
        ? ArrowDownIcon
        : ArrowUpIcon;

    return (
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 font-semibold"
        onClick={() =>
          onSort({ column, descending: sorted ? !sort.descending : false })
        }
      >
        {label}
        <Icon aria-hidden />
      </Button>
    );
  }

  const columns: ColumnDef<LibraryFile>[] = [
    {
      accessorKey: "name",
      header: () => sortableHeader("name", "Name"),
      cell: ({ row: { original: file } }) => (
        <div className="flex min-w-56 max-w-96 items-center gap-3">
          <FileThumb file={file} compact />
          <FileName
            file={file}
            isRenaming={renaming === file.id}
            draft={draft}
            onDraftChange={onDraftChange}
            onSaveRename={onSaveRename}
            onCancelRename={onCancelRename}
          />
        </div>
      ),
    },
    {
      accessorKey: "mimeType",
      header: () => sortableHeader("mimeType", "Type"),
      cell: ({ row }) => row.original.mimeType,
    },
    {
      accessorKey: "size",
      header: () => sortableHeader("size", "Size"),
      cell: ({ row }) => formatSize(row.original.size),
    },
    {
      accessorKey: "uploadedBy",
      header: () => sortableHeader("uploadedBy", "Uploaded by"),
      cell: ({ row }) => row.original.uploadedBy ?? "—",
    },
    {
      accessorKey: "createdAt",
      header: () => sortableHeader("createdAt", "Uploaded"),
      cell: ({ row }) => dateFormat.format(new Date(row.original.createdAt)),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <FileActions
          file={row.original}
          folders={folders}
          onMove={onMove}
          onStartRename={onStartRename}
          onRemove={onRemove}
        />
      ),
    },
  ];

  // The library query filters and sorts before paginating.
  const table = useReactTable({
    data: files,
    columns,
    state: {
      columnVisibility,
      sorting: [{ id: sort.column, desc: sort.descending }],
    },
    manualSorting: true,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (file) => file.id,
  });

  return <DataTable table={table} emptyMessage={emptyMessage} />;
}

export const FilesGridView: FC<FilesViewProps> = ({
  files,
  folders,
  renaming,
  draft,
  onDraftChange,
  onStartRename,
  onSaveRename,
  onCancelRename,
  onMove,
  onRemove,
}) => {
  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {files.map((file) => (
        <li
          key={file.id}
          className="flex flex-col overflow-hidden rounded-xl border border-line"
        >
          <div className="aspect-4/3 overflow-hidden">
            <FileThumb file={file} large />
          </div>
          <div className="flex flex-col gap-1 p-3">
            <FileName
              file={file}
              isRenaming={renaming === file.id}
              draft={draft}
              onDraftChange={onDraftChange}
              onSaveRename={onSaveRename}
              onCancelRename={onCancelRename}
            />
            <span className="text-xs text-ink-3">{formatSize(file.size)}</span>
            <FileActions
              file={file}
              folders={folders}
              onMove={onMove}
              onStartRename={onStartRename}
              onRemove={onRemove}
            />
          </div>
        </li>
      ))}
    </ul>
  );
};
