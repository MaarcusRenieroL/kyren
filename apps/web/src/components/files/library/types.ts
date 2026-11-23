import type { AppRouter } from "@kyren/api/server";
import type { inferRouterOutputs } from "@trpc/server";

export type LibraryFile =
  inferRouterOutputs<AppRouter>["files"]["library"][number];
export type Folder = inferRouterOutputs<AppRouter>["files"]["folders"][number];
export type Kind = "all" | "image" | "document" | "other";

export const kinds: { id: Kind; label: string }[] = [
  { id: "all", label: "All" },
  { id: "image", label: "Images" },
  { id: "document", label: "Documents" },
  { id: "other", label: "Other" },
];

export function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

export const dateFormat = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export const fileColumns = [
  { id: "name", label: "Name" },
  { id: "mimeType", label: "Type" },
  { id: "size", label: "Size" },
  { id: "uploadedBy", label: "Uploaded by" },
  { id: "createdAt", label: "Uploaded" },
] as const;

export type FileSort = {
  column: (typeof fileColumns)[number]["id"];
  descending: boolean;
};

export const emptyFileFilters = {
  uploaderId: "",
  folder: "",
  minSize: "",
  maxSize: "",
  uploadedFrom: "",
  uploadedThrough: "",
};

export type FileFilters = typeof emptyFileFilters;
