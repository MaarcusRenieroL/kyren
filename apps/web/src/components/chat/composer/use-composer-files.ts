"use client";

import {
  useCallback,
  useState,
  type ClipboardEvent,
  type DragEvent,
} from "react";
import { toastError } from "@kyren/ui/index";
import { uploadFile } from "./composer-upload";
import type { PendingFile } from "./composer-types";

export interface UseComposerFilesProps {
  canAttach?: boolean;
}

export interface UseComposerFilesReturn {
  pending: PendingFile[];
  setPending: React.Dispatch<React.SetStateAction<PendingFile[]>>;
  dragging: boolean;
  setDragging: (dragging: boolean) => void;
  reading: boolean;
  ready: PendingFile[];
  addFiles: (list: FileList | File[]) => void;
  removeFile: (key: string) => void;
  onPaste: (event: ClipboardEvent) => void;
  onDrop: (event: DragEvent) => void;
}

export function useComposerFiles({
  canAttach = true,
}: UseComposerFilesProps): UseComposerFilesReturn {
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [dragging, setDragging] = useState(false);

  const addFiles = useCallback((list: FileList | File[]) => {
    for (const file of Array.from(list)) {
      const key = `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`;
      const previewUrl = file.type.startsWith("image/")
        ? URL.createObjectURL(file)
        : undefined;

      setPending((current) => [
        ...current,
        {
          key,
          name: file.name,
          size: file.size,
          mimeType: file.type,
          progress: 0,
          previewUrl,
        },
      ]);
      uploadFile(file, (progress) =>
        setPending((current) =>
          current.map((item) =>
            item.key === key ? { ...item, progress } : item,
          ),
        ),
      )
        .then(({ id }) =>
          setPending((current) =>
            current.map((item) =>
              item.key === key ? { ...item, id, progress: 1 } : item,
            ),
          ),
        )
        .catch((error: Error) => {
          setPending((current) =>
            current.map((item) =>
              item.key === key ? { ...item, error: error.message } : item,
            ),
          );
          toastError("Upload failed", error.message);
        });
    }
  }, []);

  const removeFile = useCallback((key: string) => {
    setPending((current) => current.filter((item) => item.key !== key));
  }, []);

  const onPaste = (event: ClipboardEvent) => {
    const pasted = Array.from(event.clipboardData.files);
    if (pasted.length && canAttach) {
      event.preventDefault();
      addFiles(pasted);
    }
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    if (canAttach && event.dataTransfer.files.length) {
      addFiles(event.dataTransfer.files);
    }
  };

  const reading = pending.some((file) => !file.id && !file.error);
  const ready = pending.filter((file) => file.id);

  return {
    pending,
    setPending,
    dragging,
    setDragging,
    reading,
    ready,
    addFiles,
    removeFile,
    onPaste,
    onDrop,
  };
}
