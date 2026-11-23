"use client";

import {
  ArrowLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FolderIcon,
  FolderPlusIcon,
  ImageIcon,
  LayoutGridIcon,
  SearchIcon,
  TableIcon,
  UploadIcon,
} from "lucide-react";

import { useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@kyren/ui/shadcn/alert-dialog";
import type { LibraryFile } from "./library/types";

import { EmptyState } from "@kyren/ui/components/empty-state";
import { PageHeader } from "@kyren/ui/components/page-header";
import { Button } from "@kyren/ui/shadcn/button";
import { Input } from "@kyren/ui/shadcn/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@kyren/ui/shadcn/dropdown-menu";

import { usePermission } from "~/src/components/permissions/permission-provider";
import { formatSize, type FileSort } from "./library/types";
import { useFilesLibrary } from "./library/use-files-library";
import { FilesGridView, FilesTableView } from "./library/files-views";
import { FilesFilters } from "./library/files-filters";
import { FilesTableMenus, FileTypeFilter } from "./library/files-table-menus";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@kyren/ui/shadcn/select";

export function FilesLibrary() {
  const [deletion, setDeletion] = useState<"folder" | LibraryFile | null>(null);
  const [columnVisibility, setColumnVisibility] = useState<
    Record<string, boolean>
  >({});
  const dragDepth = useRef(0);
  const [draggingFiles, setDraggingFiles] = useState(false);
  const canUpload = usePermission("files.upload");
  const {
    inputRef,
    files,
    page,
    pageSize,
    setPageSize,
    setPage,
    hasNext,
    failed,
    usage,
    search,
    setSearch,
    kind,
    setKind,
    filters,
    setFilters,
    sort,
    setSort,
    view,
    setView,
    uploading,
    renaming,
    setRenaming,
    draft,
    setDraft,
    folders,
    setFolderId,
    folderDraft,
    setFolderDraft,
    folder,
    load,
    upload,
    rename,
    saveFolder,
    deleteFolder,
    move,
    remove,
  } = useFilesLibrary();
  const hasFilters =
    Boolean(search.trim()) ||
    kind !== "all" ||
    Object.values(filters).some(Boolean);

  const emptyMessage = hasFilters
    ? "No files match"
    : folder
      ? "This folder is empty"
      : "No files yet";
  const changeSort = (next: FileSort) => {
    setSort(next);
    setPage(1);
  };

  function openFolder(id: string | null) {
    setFolderId(id);
    setFilters((current) => ({ ...current, folder: "" }));
    setSearch("");
    setPage(1);
  }

  return (
    <div
      className="relative flex min-w-0 flex-1 flex-col gap-5 overflow-y-auto p-6"
      onDragEnter={(event) => {
        if (!canUpload || !event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        dragDepth.current += 1;
        setDraggingFiles(true);
      }}
      onDragOver={(event) => {
        if (!canUpload || !event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={() => {
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (!dragDepth.current) setDraggingFiles(false);
      }}
      onDrop={(event) => {
        if (!event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        dragDepth.current = 0;
        setDraggingFiles(false);
        if (canUpload) void upload(event.dataTransfer.files);
      }}
    >
      {draggingFiles ? (
        <div
          role="status"
          className="pointer-events-none absolute inset-2 z-20 grid place-items-center rounded-xl border-2 border-dashed border-signal bg-surface/90"
        >
          <span className="flex items-center gap-2 font-medium">
            <UploadIcon aria-hidden className="size-5" />
            Drop files here to upload{folder ? ` to ${folder.name}` : ""}
          </span>
        </div>
      ) : null}
      <PageHeader
        title="Files"
        actions={
          canUpload ? (
            <>
              <Input
                appearance="native"
                ref={inputRef}
                type="file"
                multiple
                hidden
                aria-label="Files to upload"
                onChange={(event) => void upload(event.target.files)}
              />
              <Button
                disabled={uploading > 0}
                onClick={() => inputRef.current?.click()}
              >
                <UploadIcon aria-hidden />
                {uploading > 0 ? `Uploading ${uploading}…` : "Upload"}
              </Button>
            </>
          ) : undefined
        }
      />

      {usage ? (
        <div
          className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-line bg-sunken/40 px-3 py-2 text-xs text-ink-2"
          aria-label="Storage usage"
        >
          <span className="font-medium text-ink">Storage</span>
          <progress
            className="h-2 w-24 accent-signal"
            aria-label="Storage used"
            value={Math.min(usage.used, usage.limit)}
            max={usage.limit || 1}
          />
          <span>
            {formatSize(usage.used)} of {formatSize(usage.limit)} used.
          </span>
          <span>
            {formatSize(Math.max(0, usage.limit - usage.used))} available
          </span>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1 sm:max-w-64">
          <SearchIcon
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3"
            aria-hidden
          />
          <Input
            value={search}
            maxLength={120}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search files"
            aria-label="Search files"
            className="h-8 pl-9"
          />
        </div>
        <FileTypeFilter
          kind={kind}
          onChange={(next) => {
            setKind(next);
            setPage(1);
          }}
        />
        <FilesFilters
          filters={filters}
          folders={folders}
          onChange={(next) => {
            setFilters(next);
            setPage(1);
          }}
        />
        <div
          className="ml-auto flex items-center gap-2"
          role="group"
          aria-label="File display"
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <FolderIcon aria-hidden /> Folders
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onSelect={() => openFolder(null)}>
                Library
              </DropdownMenuItem>
              {folders.map((item) => (
                <DropdownMenuItem
                  key={item.id}
                  onSelect={() => openFolder(item.id)}
                >
                  <span className="min-w-0 flex-1 truncate">{item.name}</span>
                  <span className="text-xs text-ink-3">{item.files}</span>
                </DropdownMenuItem>
              ))}
              {canUpload ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => {
                      openFolder(null);
                      setFolderDraft("");
                    }}
                  >
                    <FolderPlusIcon aria-hidden /> New folder
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
          {view === "table" && (
            <FilesTableMenus
              sort={sort}
              onSort={changeSort}
              columnVisibility={columnVisibility}
              onColumnVisibility={(column, visible) =>
                setColumnVisibility((current) => ({
                  ...current,
                  [column]: visible,
                }))
              }
            />
          )}
          <Button
            size="icon-sm"
            variant={view === "table" ? "secondary" : "ghost"}
            aria-label="Table view"
            aria-pressed={view === "table"}
            onClick={() => setView("table")}
          >
            <TableIcon aria-hidden />
          </Button>
          <Button
            size="icon-sm"
            variant={view === "grid" ? "secondary" : "ghost"}
            aria-label="Grid view"
            aria-pressed={view === "grid"}
            onClick={() => setView("grid")}
          >
            <LayoutGridIcon aria-hidden />
          </Button>
        </div>
      </div>

      {search.trim() ? null : folder ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFolderId(null);
              setFilters((current) => ({ ...current, folder: "" }));
              setPage(1);
            }}
          >
            <ArrowLeftIcon aria-hidden />
            Library
          </Button>
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <FolderIcon className="size-4" aria-hidden />
            {folder.name}
          </h2>
          {folder.canManage ? (
            <div className="ml-auto flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFolderDraft(folder.name)}
              >
                Rename folder
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDeletion("folder")}
              >
                Delete folder
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {folderDraft !== null ? (
        <Input
          autoFocus
          value={folderDraft}
          aria-label="Folder name"
          className="max-w-xs"
          onChange={(event) => setFolderDraft(event.target.value)}
          onBlur={() => void saveFolder()}
          onKeyDown={(event) => {
            if (event.key === "Enter") void saveFolder();
            if (event.key === "Escape") setFolderDraft(null);
          }}
        />
      ) : null}

      {failed ? (
        <EmptyState
          title="Files did not load"
          description="Check your connection and try again."
          action={<Button onClick={() => void load()}>Retry</Button>}
        />
      ) : files === null ? (
        <p className="text-sm text-ink-2" role="status">
          Loading files…
        </p>
      ) : view === "grid" && files.length === 0 ? (
        <EmptyState
          icon={<ImageIcon className="size-4" aria-hidden />}
          title={emptyMessage}
          description={
            hasFilters
              ? "Try a different search or filter."
              : canUpload
                ? "Upload a file and it shows up here for everyone."
                : "Files your team uploads show up here."
          }
          action={
            hasFilters || !canUpload ? undefined : (
              <Button onClick={() => inputRef.current?.click()}>
                <UploadIcon aria-hidden />
                Upload a file
              </Button>
            )
          }
        />
      ) : view === "table" ? (
        <FilesTableView
          files={files}
          sort={sort}
          onSort={changeSort}
          columnVisibility={columnVisibility}
          emptyMessage={emptyMessage}
          folders={folders}
          renaming={renaming}
          draft={draft}
          onDraftChange={setDraft}
          onStartRename={(file) => {
            setDraft(file.name);
            setRenaming(file.id);
          }}
          onSaveRename={rename}
          onCancelRename={() => setRenaming(null)}
          onMove={move}
          onRemove={setDeletion}
        />
      ) : (
        <FilesGridView
          files={files}
          folders={folders}
          renaming={renaming}
          draft={draft}
          onDraftChange={setDraft}
          onStartRename={(file) => {
            setDraft(file.name);
            setRenaming(file.id);
          }}
          onSaveRename={rename}
          onCancelRename={() => setRenaming(null)}
          onMove={move}
          onRemove={setDeletion}
        />
      )}
      {files !== null && !failed && (
        <nav
          aria-label="Files pagination"
          className="flex flex-wrap items-center justify-between gap-3"
        >
          <span className="text-xs text-ink-3">
            {files.length} {files.length === 1 ? "file" : "files"} on this page
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-ink-2">Rows per page</span>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => {
                setPageSize(Number(value));
                setPage(1);
              }}
            >
              <SelectTrigger aria-label="Rows per page" className="h-8 w-18">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 25, 50, 100].map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="mx-2 text-xs text-ink-2" aria-live="polite">
              Page {page}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Previous page"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeftIcon aria-hidden />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Next page"
              disabled={!hasNext}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRightIcon aria-hidden />
            </Button>
          </div>
        </nav>
      )}
      <AlertDialog
        open={deletion !== null}
        onOpenChange={(open) => {
          if (!open) setDeletion(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deletion === "folder"
                ? `Delete folder “${folder?.name}”?`
                : `Delete “${deletion?.name}”?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deletion === "folder"
                ? "Its files stay in the library."
                : "This permanently deletes the file."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletion === "folder") {
                  setPage(1);
                  void deleteFolder();
                } else if (deletion) void remove(deletion);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
