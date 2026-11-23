import { useCallback, type RefObject } from "react";
import { toast, toastError } from "@kyren/ui/index";
import { boardTheme } from "@kyren/ui/lib/theme-colors";
import { apiPath } from "~/src/lib/paths";
import { boardPng, boardSvg, download } from "../canvas/export";
import {
  bounds,
  live,
  newId,
  union,
  type Box,
  type El,
  type Point,
} from "../canvas/model";
import type { PickedTask } from "../canvas/task-picker";
import { templates } from "../canvas/templates";

export function useBoardInserts({
  add,
  viewCentre,
  fit,
  setPicking,
  setTool,
  setMenu,
  latest,
  selectionBox,
  layerRef,
  resolvedTheme,
  title,
}: {
  add: (fresh: El[]) => void;
  viewCentre: () => Point;
  fit: (box?: Box | null) => void;
  setPicking: (picking: boolean) => void;
  setTool: (tool: any) => void;
  setMenu: (menu: any) => void;
  latest: RefObject<El[]>;
  selectionBox: Box | null;
  layerRef: RefObject<SVGGElement | null>;
  resolvedTheme?: string;
  title: string;
}) {
  const addTask = useCallback(
    (task: PickedTask) => {
      const c = viewCentre();
      add([
        {
          id: newId(),
          type: "task",
          x: c.x - 130,
          y: c.y - 55,
          w: 260,
          h: 110,
          color: boardTheme.task.key,
          taskKey: task.key,
          taskTitle: task.name,
          taskStatus: task.status,
        },
      ]);
      setPicking(false);
      setTool("select");
    },
    [add, viewCentre, setPicking, setTool],
  );

  const addImage = useCallback(
    async (file: File, at?: Point) => {
      const body = new FormData();
      body.append("file", file);
      body.append("library", "1");

      try {
        const response = await fetch(apiPath("/api/files"), {
          method: "POST",
          body,
        });
        const saved = (await response.json()) as {
          id?: string;
          width?: number | null;
          height?: number | null;
          error?: string;
        };

        if (!response.ok || !saved.id) {
          throw new Error(saved.error ?? "Could not upload the image.");
        }

        const scale = Math.min(
          1,
          480 / Math.max(saved.width ?? 480, saved.height ?? 360),
        );
        const w = (saved.width ?? 480) * scale;
        const h = (saved.height ?? 360) * scale;
        const c = at ?? viewCentre();

        add([
          {
            id: newId(),
            type: "image",
            x: c.x - w / 2,
            y: c.y - h / 2,
            w,
            h,
            color: boardTheme.text,
            fileId: saved.id,
          },
        ]);
      } catch (error) {
        toastError(
          "Could not add the image",
          error instanceof Error ? error.message : undefined,
        );
      }
    },
    [add, viewCentre],
  );

  const addTemplate = useCallback(
    (templateId: string) => {
      const template = templates.find((one) => one.id === templateId);
      if (!template) return;

      const c = viewCentre();
      const built = template.build({ x: c.x - 300, y: c.y - 200 });

      add(built);
      setMenu(null);
      fit(union(built.map(bounds)));
    },
    [add, viewCentre, fit, setMenu],
  );

  const exportBoard = useCallback(
    async (format: "png" | "svg" | "copy") => {
      setMenu(null);
      const shown = live(latest.current);
      const area = selectionBox ?? union(shown.map(bounds));

      if (!area || !layerRef.current) {
        toast("Nothing to export", {
          description: "Draw something on the board first.",
        });
        return;
      }

      const dark = resolvedTheme === "dark";
      const name = (title || "board").replace(/[^\w-]+/g, "-");

      try {
        if (format === "svg") {
          const { markup } = await boardSvg(layerRef.current, area, dark);
          download(new Blob([markup], { type: "image/svg+xml" }), name + ".svg");
          return;
        }

        const png = await boardPng(layerRef.current, area, dark);

        if (format === "png") {
          download(png, name + ".png");
          return;
        }

        if (format === "copy") {
          if (!("ClipboardItem" in window)) {
            throw new Error("This browser cannot copy images directly.");
          }
          await navigator.clipboard.write([
            new ClipboardItem({ "image/png": png }),
          ]);
          toast("Copied to clipboard", {
            description: "Paste it straight into docs or chats.",
          });
        }
      } catch (error) {
        toastError(
          "Could not export",
          error instanceof Error ? error.message : undefined,
        );
      }
    },
    [latest, selectionBox, layerRef, resolvedTheme, title, setMenu],
  );

  return {
    addTask,
    addImage,
    addTemplate,
    exportBoard,
  };
}
