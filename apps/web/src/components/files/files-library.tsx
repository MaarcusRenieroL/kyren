"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeftIcon,
  DownloadIcon,
  FileIcon,
  FolderIcon,
  FolderPlusIcon,
  ImageIcon,
  LayoutGridIcon,
  ListIcon,
  PencilIcon,
  SearchIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";

import { useTrpcClient } from "@zentro/api/react";
import type { AppRouter } from "@zentro/api/server";
import type { inferRouterOutputs } from "@trpc/server";
import { EmptyState } from "@zentro/ui/components/empty-state";
import { PageHeader } from "@zentro/ui/components/page-header";
import { Button } from "@zentro/ui/shadcn/button";
import { Input } from "@zentro/ui/shadcn/input";
import { NativeSelect } from "@zentro/ui/shadcn/native-select";
import { toast, toastError } from "@zentro/ui/index";

import { usePermission } from "~/src/components/permissions/permission-provider";
import { apiPath } from "~/src/lib/paths";

type LibraryFile = inferRouterOutputs<AppRouter>["files"]["library"][number];
type Folder = inferRouterOutputs<AppRouter>["files"]["folders"][number];
type Kind = "all" | "image" | "document" | "other";

const kinds: { id: Kind; label: string }[] = [
  { id: "all", label: "All" },
  { id: "image", label: "Images" },
  { id: "document", label: "Documents" },
  { id: "other", label: "Other" },
];

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

const dateFormat = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function Thumb({ file, large }: { file: LibraryFile; large?: boolean }) {
  const isImage = file.mimeType.startsWith("image/");

  if (isImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={file.url}
        alt=""
        loading="lazy"
        className={
          large
            ? "size-full object-cover"
            : "size-10 rounded-md border border-line object-cover"
        }
      />
    );
  }

  return (
    <span
      className={
        large
          ? "flex size-full items-center justify-center bg-sunken text-ink-2"
          : "flex size-10 items-center justify-center rounded-md border border-line bg-sunken text-ink-2"
      }
    >
      <FileIcon className={large ? "size-8" : "size-4"} aria-hidden />
    </span>
  );
}

export function FilesLibrary() {
  const trpc = useTrpcClient();
  const canUpload = usePermission("files.upload");
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<LibraryFile[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [usage, setUsage] = useState<{ used: number; limit: number } | null>(
    null,
  );
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<Kind>("all");
  const [view, setView] = useState<"list" | "grid">("list");
  const [uploading, setUploading] = useState(0);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [folders, setFolders] = useState<Folder[]>([]);
  // The folder being looked at; null is the top of the library.
  const [folderId, setFolderId] = useState<string | null>(null);
  const [folderDraft, setFolderDraft] = useState<string | null>(null);
  const folder = folders.find((item) => item.id === folderId) ?? null;

  const load = useCallback(async () => {
    try {
      setFiles(
        await trpc.files.library.query({
          search: search || undefined,
          kind,
          folderId,
        }),
      );
      setFolders(await trpc.files.folders.query());
      setFailed(false);
      setUsage(await trpc.files.usage.query().catch(() => null));
    } catch {
      setFailed(true);
    }
  }, [trpc, search, kind, folderId]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), search ? 200 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

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
    await load();
  }

  async function rename(file: LibraryFile) {
    const name = draft.trim();
    setRenaming(null);

    if (!name || name === file.name) return;

    try {
      await trpc.files.rename.mutate({ id: file.id, name });
      await load();
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
      } else {
        const { id } = await trpc.files.createFolder.mutate({ name });

        setFolderId(id);
      }

      await load();
    } catch (error) {
      toastError(
        "Could not save the folder",
        error instanceof Error ? error.message : undefined,
      );
    }
  }

  async function deleteFolder() {
    if (
      !folder ||
      !window.confirm(
        `Delete the folder “${folder.name}”? Its files stay in the library.`,
      )
    )
      return;

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
      await load();
    } catch (error) {
      toastError(
        "Could not move the file",
        error instanceof Error ? error.message : undefined,
      );
    }
  }

  async function remove(file: LibraryFile) {
    if (!window.confirm(`Delete “${file.name}”? This cannot be undone.`))
      return;

    try {
      await trpc.files.remove.mutate({ id: file.id });
      toast.success("File deleted");
      await load();
    } catch (error) {
      toastError(
        "Could not delete the file",
        error instanceof Error ? error.message : undefined,
      );
    }
  }

  function actions(file: LibraryFile) {
    return (
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon-sm" asChild>
          <a
            href={file.url}
            download={file.name}
            aria-label={`Download ${file.name}`}
          >
            <DownloadIcon aria-hidden />
          </a>
        </Button>
        {file.canManage && folders.length ? (
          <NativeSelect
            aria-label={`Move ${file.name}`}
            value={file.folderId ?? ""}
            onChange={(event) => void move(file, event.target.value)}
            className="h-8 w-36 text-xs"
          >
            <option value="">No folder</option>
            {folders.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </NativeSelect>
        ) : null}
        {file.canManage ? (
          <>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Rename ${file.name}`}
              onClick={() => {
                setDraft(file.name);
                setRenaming(file.id);
              }}
            >
              <PencilIcon aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Delete ${file.name}`}
              onClick={() => void remove(file)}
            >
              <Trash2Icon aria-hidden />
            </Button>
          </>
        ) : null}
      </div>
    );
  }

  function name(file: LibraryFile) {
    if (renaming === file.id) {
      return (
        <Input
          autoFocus
          value={draft}
          aria-label="File name"
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => void rename(file)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void rename(file);
            if (event.key === "Escape") setRenaming(null);
          }}
        />
      );
    }

    return (
      <a
        href={file.url}
        target="_blank"
        rel="noreferrer"
        className="truncate text-sm font-medium text-ink hover:underline"
      >
        {file.name}
      </a>
    );
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-6 overflow-y-auto p-6">
      <PageHeader
        title="Files"
        description={`Everything your team has shared, in one place.${
          usage
            ? ` ${formatSize(usage.used)} of ${formatSize(usage.limit)} used.`
            : ""
        }`}
        actions={
          canUpload ? (
            <>
              <input
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

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1 sm:max-w-sm">
          <SearchIcon
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search files"
            aria-label="Search files"
            className="pl-9"
          />
        </div>
        <div className="flex gap-1" role="group" aria-label="File type">
          {kinds.map((item) => (
            <Button
              key={item.id}
              size="sm"
              variant={kind === item.id ? "secondary" : "ghost"}
              aria-pressed={kind === item.id}
              onClick={() => setKind(item.id)}
            >
              {item.label}
            </Button>
          ))}
        </div>
        <div className="ml-auto flex gap-1" role="group" aria-label="View">
          <Button
            size="icon-sm"
            variant={view === "list" ? "secondary" : "ghost"}
            aria-label="List view"
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
          >
            <ListIcon aria-hidden />
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

      {search ? null : folder ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setFolderId(null)}>
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
                onClick={() => void deleteFolder()}
              >
                Delete folder
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <ul className="flex flex-wrap gap-2" aria-label="Folders">
          {folders.map((item) => (
            <li key={item.id}>
              <Button variant="outline" onClick={() => setFolderId(item.id)}>
                <FolderIcon aria-hidden />
                {item.name}
                <span className="text-xs text-ink-3">{item.files}</span>
              </Button>
            </li>
          ))}
          {canUpload ? (
            <li>
              <Button variant="ghost" onClick={() => setFolderDraft("")}>
                <FolderPlusIcon aria-hidden />
                New folder
              </Button>
            </li>
          ) : null}
        </ul>
      )}

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
      ) : files.length === 0 ? (
        <EmptyState
          icon={<ImageIcon className="size-4" aria-hidden />}
          title={
            search || kind !== "all"
              ? "No files match"
              : folder
                ? "This folder is empty"
                : "No files yet"
          }
          description={
            search || kind !== "all"
              ? "Try a different search or filter."
              : canUpload
                ? "Upload a file and it shows up here for everyone."
                : "Files your team uploads show up here."
          }
          action={
            search || kind !== "all" || !canUpload ? undefined : (
              <Button onClick={() => inputRef.current?.click()}>
                <UploadIcon aria-hidden />
                Upload a file
              </Button>
            )
          }
        />
      ) : view === "list" ? (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {files.map((file) => (
            <li key={file.id} className="flex items-center gap-3 px-4 py-3">
              <Thumb file={file} />
              <div className="flex min-w-0 flex-1 flex-col">
                {name(file)}
                <span className="text-xs text-ink-3">
                  {formatSize(file.size)} · {file.uploadedBy ?? "Someone"} ·{" "}
                  {dateFormat.format(new Date(file.createdAt))}
                </span>
              </div>
              {actions(file)}
            </li>
          ))}
        </ul>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {files.map((file) => (
            <li
              key={file.id}
              className="flex flex-col overflow-hidden rounded-xl border border-line"
            >
              <div className="aspect-4/3 overflow-hidden">
                <Thumb file={file} large />
              </div>
              <div className="flex flex-col gap-1 p-3">
                {name(file)}
                <span className="text-xs text-ink-3">
                  {formatSize(file.size)}
                </span>
                {actions(file)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
