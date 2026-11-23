import { useEffect, type RefObject } from "react";
import { holdsLabel, touch, type El } from "../canvas/model";
import { rerouteAround } from "../canvas/geometry";
import { tools, type Tool } from "./editor-types";

export function useBoardHotkeys({
  canEdit,
  presenting,
  frames,
  present,
  setHelpOpen,
  setShowMap,
  space,
  zoomBy,
  fit,
  undo,
  redo,
  shown,
  selected,
  setSelected,
  selection,
  copy,
  removeSelected,
  paste,
  group,
  lock,
  restack,
  setTool,
  setEditing,
  replace,
  commit,
  latest,
  addImage,
}: {
  canEdit: boolean;
  presenting: number | null;
  frames: El[];
  present: (index: number | null) => void;
  setHelpOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setShowMap: React.Dispatch<React.SetStateAction<boolean>>;
  space: RefObject<boolean>;
  zoomBy: (factor: number) => void;
  fit: () => void;
  undo: () => void;
  redo: () => void;
  shown: El[];
  selected: string[];
  setSelected: (ids: string[]) => void;
  selection: El[];
  copy: () => void;
  removeSelected: () => void;
  paste: (offset?: number) => void;
  group: (on: boolean) => void;
  lock: (on: boolean) => void;
  restack: (front: boolean) => void;
  setTool: (tool: Tool) => void;
  setEditing: (editing: { id: string; text: string } | null) => void;
  replace: (els: El[]) => void;
  commit: (els: El[], record?: boolean) => void;
  latest: RefObject<El[]>;
  addImage: (file: File) => Promise<void>;
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (target.closest("textarea, input, [role=dialog]")) return;

      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();

      if (presenting !== null) {
        if (key === "arrowright" || key === " ") {
          present(Math.min(frames.length - 1, presenting + 1));
        } else if (key === "arrowleft") {
          present(Math.max(0, presenting - 1));
        } else if (key === "escape") {
          present(null);
        }
        event.preventDefault();
        return;
      }

      if (event.key === "?") {
        setHelpOpen((open) => !open);
        return;
      }

      if (key === "m" && !mod) {
        setShowMap((s) => !s);
        return;
      }

      if (key === " " && !space.current) {
        space.current = true;
        return;
      }

      if (mod && (key === "=" || key === "+")) {
        event.preventDefault();
        zoomBy(1.2);
        return;
      }

      if (mod && key === "-") {
        event.preventDefault();
        zoomBy(1 / 1.2);
        return;
      }

      if (event.shiftKey && key === "1") {
        fit();
        return;
      }

      if (!canEdit) return;

      if (mod && key === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if (mod && key === "y") {
        event.preventDefault();
        redo();
      } else if (mod && key === "a") {
        event.preventDefault();
        setSelected(shown.map((el) => el.id));
      } else if (mod && key === "c") {
        copy();
      } else if (mod && key === "x") {
        copy();
        removeSelected();
      } else if (mod && key === "v") {
        paste();
      } else if (mod && key === "d") {
        event.preventDefault();
        copy();
        paste(20);
      } else if (mod && key === "g") {
        event.preventDefault();
        group(!event.shiftKey);
      } else if (mod && event.shiftKey && key === "l") {
        event.preventDefault();
        lock(!selection.every((el) => el.locked));
      } else if (key === "]") {
        restack(true);
      } else if (key === "[") {
        restack(false);
      } else if (key === "delete" || key === "backspace") {
        event.preventDefault();
        removeSelected();
      } else if (key === "escape") {
        setSelected([]);
        setTool("select");
      } else if (
        key === "enter" &&
        selection.length === 1 &&
        holdsLabel(selection[0]!)
      ) {
        event.preventDefault();
        setEditing({ id: selection[0]!.id, text: selection[0]!.text ?? "" });
      } else if (key.startsWith("arrow") && selection.length) {
        event.preventDefault();
        const step = event.shiftKey ? 10 : 1;
        const dx =
          key === "arrowleft" ? -step : key === "arrowright" ? step : 0;
        const dy = key === "arrowup" ? -step : key === "arrowdown" ? step : 0;

        replace(
          selection
            .filter((el) => !el.locked)
            .map((el) => touch(el, { x: el.x + dx, y: el.y + dy })),
        );
        commit(rerouteAround(latest.current, new Set(selected)), false);
      } else if (!mod && !event.altKey) {
        const pick = tools.find((one) => one.key === key);
        if (pick) setTool(pick.id);
      }
    }

    function onKeyUp(event: KeyboardEvent) {
      if (event.key === " ") space.current = false;
    }

    function onPaste(event: ClipboardEvent) {
      if (!canEdit || (event.target as HTMLElement).closest("textarea, input")) {
        return;
      }
      const image = Array.from(event.clipboardData?.files ?? []).find((file) =>
        file.type.startsWith("image/"),
      );
      if (image) {
        event.preventDefault();
        void addImage(image);
      }
    }

    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("paste", onPaste);

    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("paste", onPaste);
    };
  }, [
    canEdit,
    presenting,
    frames,
    present,
    setHelpOpen,
    setShowMap,
    space,
    zoomBy,
    fit,
    undo,
    redo,
    shown,
    selected,
    setSelected,
    selection,
    copy,
    removeSelected,
    paste,
    group,
    lock,
    restack,
    setTool,
    setEditing,
    replace,
    commit,
    latest,
    addImage,
  ]);
}
