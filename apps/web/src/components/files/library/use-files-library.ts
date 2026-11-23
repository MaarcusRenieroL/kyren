"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTrpcClient } from "@zentro/api/react";
import { toast, toastError } from "@zentro/ui/index";
import { apiPath } from "~/src/lib/paths";
import {
  emptyFileFilters,
  type FileFilters,
  type FileSort,
  type Folder,
  type Kind,
  type LibraryFile,
} from "./types";

function localDateBoundary(value: string, nextDay = false) {
  if (!value) return undefined;

  const date = new Date(`${value}T00:00:00`);
  if (nextDay) date.setDate(date.getDate() + 1);
  return date.toISOString();
}

export function useFilesLibrary() {
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const trpc = useTrpcClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<LibraryFile[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [usage, setUsage] = useState<{ used: number; limit: number } | null>(
    null,
  );
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<Kind>("all");
  const [filters, setFilters] = useState<FileFilters>(emptyFileFilters);
  const [sort, setSort] = useState<FileSort>({
    column: "createdAt",
    descending: true,
  });
  const [view, setView] = useState<"table" | "grid">("table");
  const [uploading, setUploading] = useState(0);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [folders, setFolders] = useState<Folder[]>([]);
  // The folder being looked at; null is the top of the library.
  const [folderId, setFolderId] = useState<string | null>(null);
  const [folderDraft, setFolderDraft] = useState<string | null>(null);
  const folder = folders.find((item) => item.id === folderId) ?? null;

  const [revision, setRevision] = useState(0);
  const load = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    let active = true;
    async function fetchLibrary() {
      try {
        const [nextFiles, nextFolders, nextUsage] = await Promise.all([
          trpc.files.library.query({
            search: search.trim() || undefined,
            kind,
            uploaderId: filters.uploaderId || undefined,
            minBytes:
              filters.minSize === ""
                ? undefined
                : Math.ceil(Number(filters.minSize) * 1024 ** 2),
            maxBytes:
              filters.maxSize === ""
                ? undefined
                : Math.floor(Number(filters.maxSize) * 1024 ** 2),
            uploadedFrom: localDateBoundary(filters.uploadedFrom),
            uploadedBefore: localDateBoundary(filters.uploadedThrough, true),
            sort,
            folderId:
              filters.folder === "all"
                ? undefined
                : filters.folder === "unfiled"
                  ? null
                  : filters.folder || folderId,
            searchWithinFolder: Boolean(filters.folder),
            offset: (page - 1) * pageSize,
            limit: pageSize + 1,
          }),
          trpc.files.folders.query(),
          trpc.files.usage.query().catch(() => null),
        ]);
        if (!active) return;
        if (page > 1 && nextFiles.length === 0) {
          setPage(page - 1);
          return;
        }
        setHasNext(nextFiles.length > pageSize);
        setFiles(nextFiles.slice(0, pageSize));
        setFolders(nextFolders);
        setUsage(nextUsage);
        setFailed(false);
      } catch {
        if (active) setFailed(true);
      }
    }
    const timer = setTimeout(() => void fetchLibrary(), search ? 200 : 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [trpc, search, kind, filters, sort, folderId, revision, page, pageSize]);

  async function upload(list: FileList | null) {
    if (!list?.length) return;

    for (const file of Array.from(list)) {
      setUploading((count) => count + 1);

      try {
        const body = new FormData();
        body.append("file", file);
        body.append("library", "1");
        // Uploaded inside a folder, it is filed there in the same step.
        if (folderId) body.append("folderId", folderId);
        const response = await fetch(apiPath("/api/files"), {
          method: "POST",
          body,
        });

        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(data?.error ?? "Could not upload the file.");
        }
      } catch (error) {
        toastError(
          `Could not upload ${file.name}`,
          error instanceof Error ? error.message : undefined,
        );
      } finally {
        setUploading((count) => count - 1);
      }
    }

    if (inputRef.current) inputRef.current.value = "";
    load();
  }

  async function rename(file: LibraryFile) {
    const name = draft.trim();
    setRenaming(null);

    if (!name || name === file.name) return;

    try {
      await trpc.files.rename.mutate({ id: file.id, name });
      load();
    } catch (error) {
      toastError(
        "Could not rename the file",
        error instanceof Error ? error.message : undefined,
      );
    }
  }

  async function saveFolder() {
    const name = folderDraft?.trim();
    setFolderDraft(null);

    if (!name) return;

    try {
      if (folder) {
        await trpc.files.renameFolder.mutate({ id: folder.id, name });
        load();
      } else {
        const { id } = await trpc.files.createFolder.mutate({ name });
        setFolderId(id);
      }
    } catch (error) {
      toastError(
        "Could not save the folder",
        error instanceof Error ? error.message : undefined,
      );
    }
  }

  async function deleteFolder() {
    if (!folder) return;

    try {
      await trpc.files.deleteFolder.mutate({ id: folder.id });
      setFolderId(null);
      toast.success("Folder deleted");
    } catch (error) {
      toastError(
        "Could not delete the folder",
        error instanceof Error ? error.message : undefined,
      );
    }
  }

  async function move(file: LibraryFile, target: string) {
    try {
      await trpc.files.moveFile.mutate({
        id: file.id,
        folderId: target || null,
      });
      load();
    } catch (error) {
      toastError(
        "Could not move the file",
        error instanceof Error ? error.message : undefined,
      );
    }
  }

  async function remove(file: LibraryFile) {
    try {
      await trpc.files.remove.mutate({ id: file.id });
      toast.success("File deleted");
      load();
    } catch (error) {
      toastError(
        "Could not delete the file",
        error instanceof Error ? error.message : undefined,
      );
    }
  }

  return {
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
    folderId,
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
  };
}
