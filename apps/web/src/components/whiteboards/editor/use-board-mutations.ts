import type { RefObject } from "react";
import type { Box, El } from "../canvas/model";
import type { BoardStyle, View } from "./editor-types";
import { useBoardCrud } from "./use-board-crud";
import { useBoardViewActions } from "./use-board-view-actions";
import { useBoardInserts } from "./use-board-inserts";

export function useBoardMutations({
  latest,
  setElements,
  selected,
  setSelected,
  selection,
  selectionBox,
  view,
  setView,
  svgRef,
  layerRef,
  dirty,
  setSave,
  remote,
  setStyle,
  setPicking,
  setTool,
  setMenu,
  resolvedTheme,
  title,
}: {
  latest: RefObject<El[]>;
  setElements: React.Dispatch<React.SetStateAction<El[]>>;
  selected: string[];
  setSelected: React.Dispatch<React.SetStateAction<string[]>>;
  selection: El[];
  selectionBox: Box | null;
  view: View;
  setView: React.Dispatch<React.SetStateAction<View>>;
  svgRef: RefObject<SVGSVGElement | null>;
  layerRef: RefObject<SVGGElement | null>;
  dirty: RefObject<boolean>;
  setSave: (save: "saved" | "saving" | "dirty" | "error") => void;
  remote: RefObject<Map<string, number>>;
  setStyle: React.Dispatch<React.SetStateAction<BoardStyle>>;
  setPicking: (picking: boolean) => void;
  setTool: (tool: any) => void;
  setMenu: (menu: any) => void;
  resolvedTheme?: string;
  title: string;
}) {
  const crud = useBoardCrud({
    latest,
    setElements,
    selected,
    setSelected,
    selection,
    dirty,
    setSave,
    remote,
    setStyle,
  });

  const viewActions = useBoardViewActions({
    view,
    setView,
    svgRef,
    latest,
    selection,
    selectionBox,
    selected,
    replace: crud.replace,
    commit: crud.commit,
  });

  const inserts = useBoardInserts({
    add: crud.add,
    viewCentre: viewActions.viewCentre,
    fit: viewActions.fit,
    setPicking,
    setTool,
    setMenu,
    latest,
    selectionBox,
    layerRef,
    resolvedTheme,
    title,
  });

  return {
    ...crud,
    ...viewActions,
    ...inserts,
  };
}
